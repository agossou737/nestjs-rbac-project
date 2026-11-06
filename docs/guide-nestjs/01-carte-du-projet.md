# 01. Carte du projet et cycle d'une requête

Avant d'ajouter du code, il faut savoir lire celui qui existe. Ce chapitre explique comment NestJS assemble l'application et ce qui arrive à une requête HTTP, de son arrivée à la réponse.

Fichiers à ouvrir : `backend/src/main.ts`, `backend/src/configure-app.ts`, `backend/src/app.module.ts`, `backend/src/users/`.

## 1. Le point d'entrée : `main.ts`

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
configureApp(app);
await app.listen(port);
```

`NestFactory.create` lit le module racine `AppModule`, construit tous les objets dont l'application a besoin, puis `configureApp` branche ce qui s'applique à toutes les requêtes : préfixe `/api/v1`, Helmet, CORS, validation, filtre d'erreurs. Cette fonction est séparée de `main.ts` pour une raison précise : les tests e2e l'appellent aussi, si bien que les tests passent par exactement le même chemin que la production.

## 2. Les modules : découper l'application

Un **module** regroupe ce qui va ensemble : un contrôleur (les routes), des services (la logique), et la liste de ce qu'il partage avec les autres.

```ts
@Module({
  imports: [AuthModule],          // modules dont j'ai besoin
  controllers: [UsersController], // mes routes HTTP
  providers: [UsersService],      // mes classes injectables
})
export class UsersModule {}
```

Dans ce projet, il y a un module par domaine : `auth`, `users`, `roles`, `permissions`, `activity-logs`, `login-history`, `dashboard`, `health`, plus des modules techniques (`prisma`, `rbac`, `mail`). `AppModule` les importe tous.

Un module ne voit que ce qu'il importe. `UsersModule` importe `AuthModule` parce que `UsersService` a besoin d'`AuthService` (pour envoyer l'invitation). Et `AuthModule` doit l'autoriser explicitement avec `exports: [AuthService, RefreshTokenService]`. C'est ce qui garde une grosse application lisible : les dépendances entre domaines sont déclarées, pas devinées.

**Modules globaux.** `PrismaModule`, `RbacModule` et `ActivityLogsModule` portent `@Global()` : leurs services sont disponibles partout sans import. Réservez-le aux briques vraiment transverses (base de données, journal, contrôle d'accès). Un module métier global cache ses dépendances, ce qui coûte cher dans un gros projet.

## 3. L'injection de dépendances

Regardez le constructeur de `UsersService` :

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly policy: AccessPolicy,
  private readonly auth: AuthService,
  ...
) {}
```

Personne n'écrit jamais `new UsersService(...)`. NestJS lit les types du constructeur, trouve les classes correspondantes parmi les providers visibles, les crée une seule fois (ce sont des singletons) et les passe. C'est l'**injection de dépendances**.

Ce que cela vous apporte :

- **les tests** peuvent remplacer une dépendance. Dans `backend/test/utils/test-app.ts`, `.overrideProvider(MailService).useValue(mail)` remplace le vrai service d'e-mail par un faux qui enregistre les messages ;
- **la configuration** arrive de la même façon : `ConfigService` est injecté là où on lit une variable d'environnement.

Piège classique : NestJS a besoin des métadonnées de type que TypeScript émet avec `emitDecoratorMetadata`. Si un outil ne les émet pas, l'injection échoue. C'est pour cette raison que `vitest.config*.ts` active `oxc.decorator.emitDecoratorMetadata`.

## 4. Le trajet d'une requête

Prenons `PATCH /api/v1/users/:id/status`.

```
Requête HTTP
  │
  ├─ 1. Middlewares Express (configure-app.ts)
  │     pino-http (journal + correlation id), Helmet, cookie-parser, CORS
  │
  ├─ 2. Guards globaux, dans l'ordre de app.module.ts
  │     ThrottlerGuard    → trop de requêtes depuis cette IP ? 429
  │     JwtAuthGuard      → jeton valide, compte actif, session non révoquée ? sinon 401
  │     PermissionsGuard  → l'utilisateur a-t-il users.update ? sinon 403
  │
  ├─ 3. Pipes
  │     ParseUUIDPipe sur :id         → pas un UUID ? 400
  │     ValidationPipe sur le body    → UpdateStatusDto invalide ? 400 avec errors[]
  │
  ├─ 4. Contrôleur  UsersController.setStatus
  │     lit les paramètres, appelle le service, ne contient aucune règle métier
  │
  ├─ 5. Service     UsersService.setStatus
  │     AccessPolicy (règles d'accès), Prisma (base), ActivityLogService (journal)
  │
  └─ 6. Réponse
        succès : l'objet renvoyé est sérialisé en JSON
        exception levée n'importe où : ProblemDetailsFilter la transforme en problem+json
```

Les cinq briques à connaître par cœur :

| Brique | Rôle | Exemple dans le projet |
|---|---|---|
| **Middleware** | Agit sur la requête brute, avant NestJS | `helmet()`, `cookieParser()` |
| **Guard** | Décide si la requête peut continuer (`true` ou exception) | `JwtAuthGuard`, `PermissionsGuard` |
| **Pipe** | Valide et transforme une entrée | `ValidationPipe`, `ParseUUIDPipe` |
| **Interceptor** | Enveloppe l'exécution (avant et après) | aucun ici ; utile pour du cache ou une mesure de durée |
| **Exception filter** | Transforme une exception en réponse | `ProblemDetailsFilter` |

## 5. Les décorateurs : des métadonnées lues par les guards

```ts
@Permissions('users.update')
@Patch(':id/status')
setStatus(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: UpdateStatusDto) { ... }
```

`@Permissions(...)` ne vérifie rien lui-même : il attache une étiquette à la méthode (`SetMetadata`). C'est `PermissionsGuard` qui lit cette étiquette avec le `Reflector`, puis compare aux permissions de l'utilisateur relues en base. Une route sans étiquette est refusée : c'est le refus par défaut.

`@Actor()` est un **décorateur de paramètre** maison (`common/actor.decorator.ts`) : il extrait de la requête l'utilisateur authentifié, son IP et son navigateur, pour que le service n'ait jamais à manipuler l'objet `Request` d'Express. Règle du projet : aucun objet HTTP n'entre dans un service.

## 6. Les DTO : la frontière de confiance

Un **DTO** (Data Transfer Object) décrit ce qu'une route accepte. Avec class-validator, chaque champ porte ses règles :

```ts
export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
```

Le `ValidationPipe` global est réglé avec `whitelist` et `forbidNonWhitelisted` : un champ non déclaré provoque un 400. C'est la protection contre l'affectation de masse. Quelqu'un qui enverrait `{"status": "ACTIVE", "password_hash": "..."}` serait refusé.

Les classes de `responses.ts` décrivent ce que l'API renvoie. Le plugin Swagger (déclaré dans `nest-cli.json`) les transforme en schéma OpenAPI, dont le frontend génère ses types.

## 7. Prisma : la couche d'accès aux données

`PrismaService` étend le client Prisma généré et est injecté partout. Le schéma (`backend/prisma/schema.prisma`) est la source de vérité. Chaque changement de schéma devient une **migration** versionnée (`prisma/migrations/`), appliquée dans l'ordre et jamais modifiée après coup.

Deux réflexes du projet à reprendre :

- **les requêtes liées vont dans une transaction** (`prisma.$transaction`) quand elles doivent réussir ou échouer ensemble (voir `RolesService.setPermissions`) ;
- **les réponses passent par un mapper** (`toUserDto`, `toRoleDto`) qui convertit le camelCase de Prisma en snake_case de l'API, et qui ne renvoie jamais un champ sensible comme `passwordHash`.

## 8. Les tests e2e : la documentation qui s'exécute

`backend/test/*.e2e-spec.ts` démarre la vraie application (avec `createTestApp`) sur une vraie base MySQL de test et l'interroge avec Supertest. Ce choix, plutôt que des tests unitaires avec des faux partout, vérifie tout le trajet de la section 4 : guards, pipes, base, filtre d'erreurs.

```ts
await request(app.getHttpServer())
  .patch(`/api/v1/users/${id}/status`)
  .set('Authorization', auth)
  .send({ status: 'INACTIVE' })
  .expect(200);
```

## Exercice

1. Lancez la suite : `cd backend && npm run test:e2e`.
2. Dans `PermissionsGuard`, remplacez temporairement `requirement.keys.every(...)` par `requirement.keys.some(...)`. Relancez : quels tests échouent, et pourquoi ? Remettez le code d'origine.
3. Retrouvez dans le code la réponse à : « que se passe-t-il si un compte est désactivé alors qu'il a encore un jeton d'accès valide ? » (indice : `jwt.strategy.ts`, méthode `validate`).

# 02. Ajouter une ressource CRUD de A à Z : les départements

Ce chapitre suit, dans l'ordre réel, l'ajout des départements : une unité organisationnelle (DSI, RH…) qui a un code, un nom, un responsable facultatif, et à laquelle des comptes sont rattachés. C'est le geste que vous répéterez le plus souvent sur un gros projet NestJS.

Fichiers à ouvrir : `backend/test/departments.e2e-spec.ts`, `backend/prisma/schema.prisma`, `backend/src/departments/`, `backend/src/users/users.service.ts`.

## Étape 1. Écrire les tests d'abord

Avant toute ligne de code, `test/departments.e2e-spec.ts` décrit le comportement attendu :

- les permissions : un compte sans rôle reçoit 403, un Viewer peut lire mais pas créer ;
- la création : code mis en majuscules, responsable facultatif, trace dans le journal ;
- les doublons de code ou de nom, quelle que soit la casse : 409 ;
- la liste paginée, triée, filtrée, avec le nombre de membres (les comptes supprimés ne comptent pas) ;
- la suppression : refusée tant que le département a des membres, puis le code redevient libre ;
- le rattachement des comptes : création, filtre, déplacement, détachement.

Lancé à ce moment-là, chaque test échoue. C'est voulu : un test qui n'a jamais échoué ne prouve rien. Remarque au passage : une route inconnue répond **404 avant tout guard**. NestJS cherche d'abord la route ; les guards ne s'exécutent que si elle existe.

```bash
npx vitest run --config ./vitest.config.e2e.ts test/departments.e2e-spec.ts
```

## Étape 2. Le schéma Prisma et la migration

```prisma
model Department {
  id          String    @id @default(uuid()) @db.Char(36)
  code        String    @unique @db.VarChar(80)
  name        String    @unique @db.VarChar(160)
  managerId   String?   @map("manager_id") @db.Char(36)
  deletedAt   DateTime? @map("deleted_at") @db.DateTime(3)

  manager User?  @relation("DepartmentManager", fields: [managerId], references: [id], onDelete: SetNull)
  members User[] @relation("DepartmentMembers")
}
```

Points à retenir :

- **Deux relations entre les mêmes tables** (un département a des membres et un responsable) : Prisma exige alors un **nom de relation** (`"DepartmentMembers"`, `"DepartmentManager"`) des deux côtés.
- **`onDelete`** décide de ce qui arrive aux lignes liées. `SetNull` pour le responsable : si son compte disparaissait physiquement, le département resterait sans responsable. `Restrict` côté membres (`User.department`) : la base refuse de supprimer un département qui a encore des membres. C'est un filet de sécurité sous la règle métier.
- **`@map` et `@@map`** : le code TypeScript parle en camelCase (`managerId`), la base en snake_case (`manager_id`).
- **Suppression logique et unicité** : `code` et `name` sont uniques, y compris pour les lignes supprimées. À la suppression, le service les renomme (`DSI [deleted <id>]`) pour libérer la valeur. C'est pourquoi les colonnes font 80 et 160 caractères alors que le DTO limite à 20 et 100.

Puis :

```bash
npx prisma migrate dev --name add_departments   # crée prisma/migrations/<date>_add_departments/migration.sql et l'applique
npx prisma generate                              # régénère le client typé (Prisma 7 ne le fait plus pendant migrate dev)
```

Relisez toujours le SQL généré avant de le commiter. Une fois appliquée ailleurs que sur votre poste, une migration ne se modifie plus : on en crée une nouvelle.

## Étape 3. Les permissions

Dans `src/rbac/permission-catalog.ts`, quatre clés `departments.read`, `create`, `update`, `delete`. Le type `PermissionKey` est calculé à partir de ce tableau : écrire `@Permissions('departments.raed')` ne compile pas.

On décide aussi qui les reçoit : l'Administrator les a toutes (son rôle est défini comme « tout sauf `roles.delete` »), et `departments.read` rejoint les rôles de consultation (Manager, Viewer, Auditor) ainsi que l'Editor, qui doit voir les départements pour y rattacher un compte. `npm run db:seed` resynchronise les rôles système de toute base existante.

## Étape 4. Les DTO : ce que l'API accepte

`src/departments/dto.ts` :

```ts
@Transform(upperCode) @IsString() @Matches(/^[A-Z0-9_-]{2,20}$/)
code!: string;

@IsOptional() @ValidateIf((_dto, value) => value !== null) @IsUUID()
manager_id?: string | null;
```

- `@Transform` s'exécute **avant** la validation : `" dsi "` devient `"DSI"`, puis est validé.
- Le champ `manager_id` a trois états, et c'est un motif à connaître : **absent** (ne rien changer), **`null`** (retirer le responsable), **un UUID** (le changer). `@ValidateIf` saute `@IsUUID` quand la valeur vaut `null`.
- On aurait pu écrire `class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}` (fonction de `@nestjs/swagger`) : tous les champs deviennent facultatifs en une ligne. C'est la pratique courante. Le DTO est écrit à la main ici pour rester lisible pendant l'apprentissage ; sur un vrai projet, préférez `PartialType`.

## Étape 5. Les réponses : ce que l'API renvoie

`src/departments/responses.ts` déclare `DepartmentResponse` sans aucun décorateur : le plugin Swagger de `nest-cli.json` lit les types et les commentaires `/** */` au moment du build. Le service annote son mapper `toDepartmentDto(...): DepartmentResponse`. Si le mapper oublie un champ ou en renvoie un de trop, la compilation échoue. Le contrat documenté et le code ne peuvent donc pas diverger.

## Étape 6. Le service : toutes les règles

`src/departments/departments.service.ts` concentre la logique. Quatre techniques à réutiliser :

**Un `include` typé, partagé par toutes les lectures.**

```ts
const withDetails = {
  manager: { select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true } },
  _count: { select: { members: { where: { deletedAt: null } } } },
} satisfies Prisma.DepartmentInclude;

type DepartmentWithDetails = Prisma.DepartmentGetPayload<{ include: typeof withDetails }>;
```

`satisfies` vérifie la forme sans perdre le type exact, et `GetPayload` en déduit le type des lignes renvoyées. `_count` avec un `where` compte uniquement les membres non supprimés, en une seule requête SQL.

**Liste et total dans la même transaction.** `prisma.$transaction([findMany, count])` garantit que la page et le total décrivent le même état de la base.

**Vérifier, puis laisser la base trancher.** `assertUnique` vérifie le code et le nom pour renvoyer un message précis. Deux créations simultanées pourraient pourtant passer cette vérification ensemble : l'index unique les départage, et le filtre global transforme l'erreur Prisma `P2002` en 409. La vérification sert le message, l'index garantit l'intégrité.

**Exposer une méthode à un autre module.** `assertActive(id)` sert à `UsersService` avant de rattacher un compte. Elle est publique, et `DepartmentsModule` exporte `DepartmentsService`.

## Étape 7. Le contrôleur : mince par principe

```ts
@Patch(':id')
@Permissions('departments.update')
@ApiOkResponse({ type: DepartmentResponse })
update(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: UpdateDepartmentDto) {
  return this.departments.update(actor, id, dto);
}
```

Chaque méthode fait une ligne. `@Id()` est un raccourci local pour `@Param('id', new ParseUUIDPipe())`. `@HttpCode(HttpStatus.NO_CONTENT)` sur `DELETE` fixe le statut 204, car NestJS renvoie 200 par défaut (201 pour un `POST`).

L'alternative à l'écriture manuelle :

```bash
npx nest g resource departments
```

Cette commande génère module, contrôleur, service, DTO et tests. Utile pour démarrer, mais il faut ensuite adapter le résultat aux conventions du projet (Prisma, `@Permissions`, réponses typées, snake_case).

## Étape 8. Brancher les modules entre eux

- `AppModule` importe `DepartmentsModule`.
- `UsersModule` importe `DepartmentsModule` pour que `UsersService` puisse recevoir `DepartmentsService` dans son constructeur.

Si deux modules ont besoin l'un de l'autre, NestJS signale une **dépendance circulaire**. Il existe un contournement, `forwardRef(() => AutreModule)`, mais c'est presque toujours le signe qu'une responsabilité est mal placée. Ici la dépendance va dans un seul sens : les utilisateurs connaissent les départements, pas l'inverse.

## Étape 9. Rattacher les comptes

Dans le module Utilisateurs, quatre changements suffisent :

1. `department_id` dans `CreateUserDto`, `UpdateUserDto` (avec le motif absent, `null` ou UUID) et le filtre `ListUsersQueryDto` ;
2. `department: { select: { id, code, name } }` dans l'`include` partagé `withRoles` ;
3. `departmentId: dto.department_id` dans les `data` de création et de modification, après `departments.assertActive(...)` ;
4. `department` dans `UserResponse` et dans le mapper `toUserDto`.

Puis le contrat et les types du frontend :

```bash
cd backend && npm run openapi:export
cd ../frontend && npm run api:generate
```

## Étape 10. Les anciens tests qui cassent

Ajouter quatre permissions a fait échouer sept anciens tests qui écrivaient « 14 permissions » en dur. Plutôt que de remplacer 14 par 18, ils comparent maintenant au catalogue : `toHaveLength(PERMISSIONS.length)`. Leçon : un test doit vérifier une règle (« le Super Administrator a toutes les permissions »), pas une valeur qui change à chaque évolution.

## Liste de contrôle pour la prochaine ressource

1. Tests e2e écrits et rouges.
2. Modèle Prisma, relations nommées, `onDelete`, index ; migration relue ; `prisma generate`.
3. Clés de permission dans le catalogue, attribution aux rôles, `db:seed`.
4. `dto.ts` (création, modification, requête de liste) et `responses.ts`.
5. Service : `include` typé, mapper typé, vérifications, journal d'activité.
6. Contrôleur mince, chaque route avec `@Permissions` et sa réponse documentée.
7. Module déclaré dans `AppModule` ; `exports` si un autre module en a besoin.
8. `openapi:export` puis `api:generate`.
9. `npm run test:e2e`, `npm test`, `npm run lint`, `npm run typecheck`.

## Exercices

1. **Facile.** Interdisez de désigner comme responsable un compte inactif (`status` différent de `ACTIVE`). Commencez par un test dans `departments.e2e-spec.ts` qui attend un 400, puis modifiez `assertActiveUser`.
2. **Moyen.** Remplacez `UpdateDepartmentDto` par `PartialType(CreateDepartmentDto)`. Vérifiez que les tests passent toujours et que Swagger (`/api/docs`) décrit les mêmes champs.
3. **Plus difficile.** Ajoutez `GET /departments/:id/members`, la liste paginée des comptes d'un département, protégée par `departments.read` **et** `users.read` (`@Permissions('departments.read', 'users.read')`). Réutilisez `toUserDto` et `pageArgs`.

# 04. Événements et files de tâches : l'e-mail d'invitation avec les rôles

Jusqu'ici, tout se passait pendant la requête HTTP. Envoyer un e-mail à la création d'un compte pose deux problèmes que les gros projets rencontrent partout :

- **le couplage** : `UsersService` ne devrait pas savoir qu'une création entraîne un e-mail, ni comment l'envoyer ;
- **la fiabilité** : si le serveur SMTP est en panne au moment de la création, l'e-mail ne doit pas être perdu, et la création ne doit pas échouer pour autant.

La réponse tient en deux outils : un **événement** pour découpler, une **file de tâches** pour fiabiliser.

Fichiers à ouvrir : `backend/src/notifications/`, `backend/src/users/users.service.ts` (méthode `create`), `backend/src/app.module.ts`, `backend/test/notifications.e2e-spec.ts`.

## 1. Le trajet complet

```
POST /api/v1/users
  │
  ├─ UsersService.create        écrit le compte, journalise
  │    └─ emit("user.created", { userId })        ← publie un fait, ne sait pas qui écoute
  │
  ├─ réponse 201 au navigateur (sans attendre l'e-mail)
  │
  └─ en arrière-plan, dans le même processus
       UserEventsListener.onUserCreated            ← reçoit l'événement
         └─ NotificationsService.queueInvitation   ← dépose une tâche { userId } dans Redis
                                                       │
       NotificationsProcessor.process  ◄───────────────┘  (worker BullMQ)
         ├─ relit le compte et ses rôles en base
         ├─ crée le lien à usage unique
         └─ MailService.sendInvitation   ← en cas d'erreur, BullMQ réessaie plus tard
```

## 2. Les événements avec `@nestjs/event-emitter`

```ts
// app.module.ts
EventEmitterModule.forRoot(),

// users.service.ts
this.events.emit(USER_CREATED, new UserCreatedEvent(user.id));

// user-events.listener.ts
@OnEvent(USER_CREATED, { async: true })
async onUserCreated(event: UserCreatedEvent) { ... }
```

`EventEmitter2` est injecté comme n'importe quel service. L'émetteur publie un **fait passé** (« un compte a été créé »), pas un ordre (« envoie un e-mail »). Demain, un second listener pourra réagir au même événement (créer un dossier personnel, prévenir un annuaire…) sans toucher à `UsersService`.

Trois points à connaître :

- **`{ async: true }`** : le listener s'exécute sans bloquer l'émetteur. Sans cette option, une exception du listener remonterait jusqu'à la requête HTTP.
- **Le listener rattrape ses erreurs** (`try`/`catch`). Un événement « oublié » ne doit pas faire échouer la création, mais il doit laisser une trace dans les journaux.
- **Ces événements restent dans le processus** : rien ne garantit leur livraison si le serveur s'arrête à ce moment-là. C'est la raison d'être de l'étape suivante. Pour des événements entre plusieurs services, on passe à un vrai bus de messages (`@nestjs/microservices` avec Kafka ou RabbitMQ).

## 3. La file de tâches avec BullMQ

BullMQ stocke les tâches dans **Redis**. Un **worker** les traite, réessaie celles qui échouent et garde un historique. Redis est ajouté au `docker-compose.yml`, avec un volume et `--appendonly yes` pour survivre à un redémarrage.

Configuration une fois pour toute l'application, puis une file par module :

```ts
// app.module.ts
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({ connection: redisConnection(config.getOrThrow('REDIS_URL')) }),
}),

// notifications.module.ts
imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }), AuthModule, MailModule],
```

**Déposer une tâche** (`notifications.service.ts`) :

```ts
await this.queue.add('invitation', { userId }, {
  jobId: `invitation-${userId}`,
  attempts: 5,
  backoff: { type: 'exponential', delay: this.retryDelayMs },
  removeOnComplete: { age: DAY_SECONDS },
  removeOnFail: { age: 7 * DAY_SECONDS },
});
```

- **`attempts` et `backoff`** : cinq essais, espacés de 30 s, 60 s, 120 s… En test, `NOTIFICATION_RETRY_DELAY_MS=50` rend les nouvelles tentatives quasi immédiates.
- **`jobId` fixe** : c'est l'**idempotence**. Un second `add` avec le même identifiant est ignoré tant que le premier existe : une même invitation ne part jamais deux fois, même si l'événement était publié deux fois.
- **`removeOnComplete` / `removeOnFail`** : sans eux, Redis garde toutes les tâches indéfiniment.

**Traiter les tâches** (`notifications.processor.ts`) :

```ts
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'invitation':
        return this.sendInvitation(job.data as InvitationJob);
      default:
        throw new Error(`Unknown notification job: ${job.name}`);
    }
  }
}
```

La règle est simple : **lever une exception, c'est demander une nouvelle tentative ; retourner normalement, c'est terminer la tâche.** Un compte supprimé entre la création et l'envoi n'est pas une erreur : le processeur retourne sans rien envoyer.

Le worker tourne ici dans le même processus que l'API, ce qui est le plus simple. Sur un gros projet, on le déplace souvent dans un processus à part (même code, autre point d'entrée), pour pouvoir le dimensionner sans toucher à l'API.

## 4. Ce qui va dans la file, et ce qui n'y va pas

La tâche ne contient **que l'identifiant du compte** : `{ userId }`. Ni l'adresse e-mail, ni le lien de réinitialisation. Le processeur relit les données et crée le jeton **au moment de l'envoi**, grâce à `AuthService.createPasswordResetUrl`, extraite pour l'occasion. Trois avantages :

- aucun secret ni donnée personnelle ne dort dans Redis ;
- l'e-mail reflète l'état réel au moment de l'envoi : les rôles du moment, et rien du tout pour un compte supprimé entre-temps ;
- si l'envoi échoue puis réussit à la tentative suivante, le jeton créé lors de l'essai raté est remplacé, et un seul lien valide circule.

Un test le vérifie : `keeps only the account id in Redis: no email address, no token`.

## 5. Le piège rencontré : `ioredis` manquant

BullMQ 6 a rendu `ioredis` **facultatif** : il ne l'installe plus. Sans lui, l'explorateur de `@nestjs/bullmq` échouait à créer le worker en boucle, jusqu'à saturer la mémoire (`JavaScript heap out of memory`), y compris dans des tests qui n'avaient rien à voir, comme celui de santé. Le diagnostic est venu du démarrage de l'application compilée hors de Vitest : son journal comptait des millions de lignes identiques pointant vers `loadIORedis`.

Correctif : `npm install ioredis`. Leçon générale : quand une montée de version majeure rend une dépendance « facultative », lisez son changelog, et quand tout un environnement de test s'effondre d'un coup, démarrez l'application seule pour voir la première erreur.

## 6. Tester un traitement asynchrone

L'e-mail part **après** la réponse HTTP. Un test qui regarde la boîte juste après le `201` échoue au hasard. `test/utils/test-app.ts` fournit donc `eventually` :

```ts
const [invitation] = await eventually(() => ctx.mail.invitations, (sent) => sent.length === 1);
```

Il réessaie la lecture toutes les 50 ms jusqu'à ce que la condition soit vraie, ou échoue au bout de 8 s avec la dernière valeur lue. Autres techniques de `notifications.e2e-spec.ts` :

- `queue.obliterate({ force: true })` vide la file avant chaque test ;
- `ctx.mail.failNext = 2` fait échouer le faux service d'e-mail deux fois, pour vérifier que la tâche réussit au troisième essai (`attemptsMade === 3`) et qu'un seul e-mail part ;
- `queue.add(...)` direct, avec un compte supprimé, prouve que le processeur ignore la tâche sans erreur.

Les tests utilisent la base Redis 1 (`REDIS_URL=redis://127.0.0.1:6381/1` dans `.env.test`), jamais celle du développement.

## Exercices

1. **Facile.** Le lien de réinitialisation demandé par un administrateur (`POST /users/:id/reset-password`) part encore directement, sans file. Faites-le passer par une tâche `password-reset` du même processeur, avec un test qui simule une panne SMTP.
2. **Moyen.** Ajoutez un second listener à `user.created` qui journalise `user.invitation_queued` dans le journal d'activité. Vérifiez qu'aucune ligne de `UsersService` n'a changé : c'est tout l'intérêt de l'événement.
3. **Plus difficile.** Exposez l'état de la file aux administrateurs : `GET /notifications/stats` (permission à créer), qui renvoie `queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')`. Puis affichez les tâches en échec dans le tableau de bord.

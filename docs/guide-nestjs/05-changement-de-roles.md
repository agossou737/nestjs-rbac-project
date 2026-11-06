# 05. Notifier un changement de rôles : un second type de tâche

Le chapitre 04 a posé la mécanique (événement, file, worker). Ajouter une seconde notification montre ce qui change d'un type de tâche à l'autre, et ce qui reste identique. Ce chapitre raconte aussi un incident réel survenu pendant la vérification : deux versions de l'application qui se partageaient la même file.

Fichiers à ouvrir : `backend/src/users/users.service.ts` (méthode `setRoles`), `backend/src/notifications/`, `backend/test/notifications.e2e-spec.ts` (bloc `roles change e-mail`).

## 1. Ce qui est réutilisé tel quel

- la **file** `notifications`, son processeur et sa politique de nouvelles tentatives (factorisée dans `NotificationsService.options`) ;
- le **listener** : une seconde méthode `@OnEvent(USER_ROLES_CHANGED, { async: true })` ;
- le **processeur** : un nouveau `case 'roles-changed'` dans `process()`, et une méthode privée `activeUserWithRoles` partagée avec l'invitation.

Ajouter un type de notification coûte donc un événement, une méthode de file, un `case` et un modèle d'e-mail. C'est le signe d'un bon découpage : on ajoute sans modifier ce qui existe.

## 2. Ce qui change : le contenu de la tâche

L'invitation ne transportait que `{ userId }`, parce que tout ce dont elle a besoin (le compte, ses rôles, un nouveau lien) se relit au moment de l'envoi. Un changement de rôles, lui, **ne se relit pas** : une fois appliqué, la base ne dit plus ce qui a été ajouté ou retiré. La tâche transporte donc le changement :

```ts
export type RolesChangedJob = { userId: string; addedRoleIds: string[]; removedRoleIds: string[] };
```

La règle reste la même (pas de donnée personnelle, pas de secret dans Redis), mais appliquée avec discernement : des **identifiants** de rôles, pas leurs noms. Le processeur retrouve les noms au moment de l'envoi, y compris pour un rôle supprimé entre-temps (suppression logique : il n'y a pas de filtre `deletedAt`, et le suffixe `[deleted …]` est retiré du nom affiché). Les rôles **actuels** du compte, eux, sont relus en base, comme pour l'invitation.

Retenez la question à vous poser pour chaque tâche : *que faut-il figer au moment de l'événement, et que vaut-il mieux relire au moment du traitement ?*

## 3. L'idempotence par changement

```ts
// users.service.ts
if (added.length > 0 || removed.length > 0) {
  this.events.emit(USER_ROLES_CHANGED, new UserRolesChangedEvent(id, added, removed, randomUUID()));
}

// notifications.service.ts
await this.queue.add('roles-changed', data, this.options(`roles-changed-${event.changeId}`));
```

L'invitation est unique par compte, d'où `jobId: invitation-${userId}`. Un changement de rôles peut se produire dix fois pour un même compte, et chaque fois mérite son e-mail. La clé d'idempotence est donc **le changement**, identifié par un `changeId` tiré au moment de l'événement. Si le même événement était mis en file deux fois (nouvelle tentative du listener, par exemple), le second ajout serait ignoré. Deux changements distincts donnent bien deux e-mails, et le test `one job per change even for the same account` le vérifie.

Et quand rien ne change (on renvoie les mêmes rôles), aucun événement n'est publié. Le test `sends nothing when the roles did not change` vérifie qu'aucun e-mail ne part et qu'aucune tâche n'est créée.

## 4. Surveiller les abandons

```ts
@OnWorkerEvent('failed')
onFailed(job: Job | undefined, error: Error): void {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    this.logger.error(`Notification ${job.name} (${job.id}) given up after ${job.attemptsMade} attempts: ${error.message}`);
  }
}
```

BullMQ émet `failed` à **chaque** tentative ratée. Seule la dernière signifie que l'e-mail est abandonné : c'est elle qu'il faut faire remonter dans les journaux (et, sur un gros projet, dans une alerte). Le journal ne contient que le nom et l'identifiant de la tâche, jamais l'adresse e-mail.

## 5. L'incident : deux versions, une seule file

En vérifiant sur la stack réelle, l'e-mail de changement n'arrivait pas. Le diagnostic, dans l'ordre :

1. la requête `PUT /users/:id/roles` répondait bien 200 ;
2. la tâche existait dans Redis (`redis-cli --scan --pattern 'bull:notifications:roles-changed-*'`) ;
3. ses champs (`HGETALL`) indiquaient `failedReason: Unknown notification job: roles-changed`, avec une pile d'appels venant de `/app/dist/...`, c'est-à-dire **du conteneur Docker**, pas de l'API lancée sur le poste ;
4. explication : l'API Docker, construite avant ce chapitre, écoutait la **même base Redis** que l'API du poste. Son worker a pris la tâche avant l'autre, ne connaissait pas `roles-changed`, et a levé une erreur.

Deux leçons, valables sur tout projet qui utilise des files :

- **Une tâche inconnue doit faire échouer le traitement, pas le terminer.** C'est le `default: throw` du processeur. La tâche a été retentée 30 s plus tard ; après la reconstruction du backend Docker, un worker à jour l'a traitée et l'e-mail est parti, sans intervention. Si le processeur avait ignoré silencieusement les tâches inconnues, l'e-mail aurait été perdu.
- **En production, déployez les consommateurs avant les producteurs.** Pendant un déploiement progressif, d'anciens workers tournent encore. Un nouveau type de tâche doit être compris par les workers *avant* que l'API ne commence à en produire, ou la politique de nouvelles tentatives doit couvrir la durée du déploiement.

Et une leçon de configuration : **une base Redis (ou un préfixe) par copie de l'application.** Depuis ce chapitre, la stack Docker utilise la base 0, les tests la base 1 et l'API lancée sur le poste la base 2 (`backend/.env.example`).

## 6. Les tests

Le bloc `roles change e-mail` de `notifications.e2e-spec.ts` couvre :

- le contenu exact : ajoutés, retirés, rôles actuels ;
- l'absence d'e-mail et de tâche sans changement ;
- deux changements successifs, deux e-mails, et des tâches qui ne contiennent que des identifiants ;
- un compte désactivé entre le changement et l'envoi : la tâche se termine sans e-mail.

`mail.service.spec.ts` vérifie le texte : les sections absentes ne s'affichent pas, et un compte qui n'a plus aucun rôle est prévenu qu'il n'a plus accès à aucun module.

## Exercices

1. **Facile.** Quand un compte perd son dernier rôle, ajoutez au message le nom de l'administrateur à contacter. Il faut transporter l'identifiant de l'acteur dans la tâche (pas son nom) et le relire.
2. **Moyen.** Regroupez les changements rapprochés : trois modifications en une minute ne devraient produire qu'un e-mail. Regardez l'option `deduplication` de BullMQ (mode « debounce ») et le paramètre `delay` de `queue.add`. Attention, il faut alors recalculer le changement net, ce qui remet en question le choix fait en section 2.
3. **Plus difficile.** Prévenez par e-mail tous les titulaires d'un rôle quand sa matrice de permissions change (`PUT /roles/:id/permissions`). Un événement doit alors produire **une tâche par destinataire** (fan-out) : pensez à `queue.addBulk` et à la taille des lots.

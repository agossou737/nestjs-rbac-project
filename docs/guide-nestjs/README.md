# Guide NestJS + React par la pratique

Ce guide accompagne le code d'Access Manager. Chaque chapitre part d'une fonctionnalité réelle du projet, explique les concepts NestJS (et React) qu'elle utilise, montre où ils se trouvent dans le code, puis propose un exercice. L'objectif : être à l'aise sur une grosse base de code NestJS + React.

Lisez les chapitres dans l'ordre. Chaque chapitre indique les fichiers à ouvrir à côté.

## Chapitres

| # | Chapitre | Ce que vous y apprenez |
|---|---|---|
| 01 | [Carte du projet et cycle d'une requête](01-carte-du-projet.md) | Modules, injection de dépendances, guards, pipes, filtres : le trajet d'une requête de bout en bout |
| 02 | [Ajouter une ressource CRUD de A à Z](02-crud-de-a-a-z.md) | Les départements : schéma Prisma et migration, permissions, DTO, service, contrôleur, tests e2e écrits d'abord |
| 03 | Côté React : du contrat OpenAPI à l'écran | À venir : types générés, TanStack Query, formulaires, écrans des départements |
| 04 | Événements et files de tâches | À venir : `@nestjs/event-emitter`, BullMQ et Redis, e-mail d'invitation avec les rôles |
| 05 | Notifications de changement de rôles | À venir : un second type de tâche, idempotence, nouvelles tentatives |

## Comment travailler avec ce guide

1. Lisez le chapitre en gardant les fichiers cités ouverts.
2. Lancez les tests du chapitre (`npm run test:e2e` dans `backend/`) et lisez-les : ils décrivent le comportement attendu mieux que n'importe quelle prose.
3. Faites l'exercice de fin de chapitre sur une branche à vous. Un exercice est réussi quand ses tests passent.

## Ce qu'un très gros projet NestJS ajoute en plus

Ce projet couvre l'essentiel. Sur une grosse base de code, attendez-vous aussi à :

- **un monorepo outillé** (Nx ou Turborepo) avec des bibliothèques partagées entre plusieurs applications ;
- **des microservices** NestJS qui communiquent par messages (`@nestjs/microservices` avec Kafka, RabbitMQ ou NATS) plutôt que par appels HTTP ;
- **CQRS** (`@nestjs/cqrs`) : commandes, requêtes et événements séparés, utile quand la logique métier devient dense ;
- **l'observabilité** : traces OpenTelemetry, métriques Prometheus, journaux corrélés (ce projet a déjà les journaux JSON et le correlation id) ;
- **du cache** (`@nestjs/cache-manager` avec Redis) et des **tâches planifiées** (`@nestjs/schedule`) ;
- **une identité centralisée** (Keycloak, OIDC) à la place de l'authentification locale.

Les chapitres 04 et 05 font un premier pas dans cette direction avec les événements et les files de tâches.

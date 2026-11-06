# Access Manager

Application de gestion des accès (RBAC) : comptes, rôles, matrice de permissions, journal d'activité et historique des connexions. Monorepo NestJS + React, base MySQL, authentification locale par JWT et refresh token en cookie HttpOnly.

Le backend est la seule barrière de sécurité : l'interface masque ce qu'un compte ne peut pas faire, mais chaque route de l'API vérifie elle-même les permissions, relues en base à chaque requête.

## Prise en main

### Ce que fait l'application

Access Manager répond à une question simple : **qui peut faire quoi** dans un système d'information. Un administrateur y gère :

- les **comptes** des agents : création par invitation e-mail, activation, désactivation, suppression ;
- les **rôles** (Administrator, Manager, Auditor…) et la **matrice des permissions** de chaque rôle, case par case ;
- l'**attribution des rôles** aux comptes, sans jamais pouvoir s'accorder plus de droits qu'il n'en possède ;
- la **traçabilité** : chaque action est inscrite dans un journal non modifiable, et chaque tentative de connexion dans un historique ;
- un **tableau de bord** qui résume l'état des comptes et des connexions.

Chaque agent ne voit dans le menu que les modules que ses rôles lui ouvrent, et l'API refuse de toute façon ce qui n'est pas permis.

### Technologies utilisées

| Partie | Technologie | Version | Rôle |
|---|---|---|---|
| Interface | React | 19 | Bibliothèque d'interface |
| | TypeScript | 7 | Typage du code |
| | Vite | 8 | Serveur de développement et build |
| | Tailwind CSS + shadcn/ui | 4 | Styles et composants (Radix UI) |
| | React Router | 8 | Navigation entre les écrans |
| | TanStack Query + Axios | 5 / 1 | Appels à l'API et cache des données |
| | React Hook Form + Zod | 7 / 4 | Formulaires et validation |
| | Recharts, Sonner, Lucide | 3 / 2 / 1 | Graphiques, notifications, icônes |
| | react-i18next | 17 | Textes en français (anglais en miroir) |
| API | NestJS | 12 | Framework de l'API REST |
| | Prisma | 7 | Accès à la base et migrations |
| | Passport + JWT | 4 | Authentification |
| | Argon2 | 0.45 | Hachage des mots de passe (Argon2id) |
| | class-validator | 0.15 | Validation des données reçues |
| | Swagger | 12 | Documentation interactive de l'API |
| | Helmet, Throttler, pino | 8 / 6 / 10 | En-têtes de sécurité, limites de débit, journaux JSON |
| Données | MySQL | 8.4 | Base de données |
| | Redis + BullMQ | 7.4 / 6 | File de tâches (e-mails en arrière-plan, nouvelles tentatives) |
| Tests | Vitest + Supertest | 4 / 7 | Tests de l'API |
| | Playwright + axe | 1.64 | Parcours complets et accessibilité |
| Exécution | Docker Compose, nginx, Node.js | 22 | Conteneurs, service de l'interface |
| | Mailpit | 1.27 | Boîte e-mail locale (invitations, réinitialisations) |

### Lancer le projet avec Docker (le plus simple)

Il faut seulement **Docker** (avec Docker Compose) et **openssl**.

1. Récupérez le projet et placez-vous dans son dossier :

   ```bash
   cd access-manager
   ```

2. Créez le fichier de configuration :

   ```bash
   cp .env.example .env
   ```

3. Générez un secret pour les jetons de connexion :

   ```bash
   openssl rand -hex 32
   ```

4. Ouvrez `.env` et remplacez chaque valeur qui commence par `change-me` :
   - `MYSQL_ROOT_PASSWORD` et `MYSQL_PASSWORD` : deux mots de passe de votre choix (lettres et chiffres) ;
   - `JWT_ACCESS_SECRET` : le secret généré à l'étape 3 ;
   - `SEED_SUPER_ADMIN_EMAIL` et `SEED_SUPER_ADMIN_PASSWORD` : le compte administrateur à créer (mot de passe de 12 caractères au moins).

5. Construisez et démarrez l'application (la première fois, comptez quelques minutes) :

   ```bash
   docker compose up -d --build
   ```

6. Créez les rôles, les permissions et le compte administrateur :

   ```bash
   docker compose exec backend npx prisma db seed
   ```

   Cette commande peut être relancée sans risque : elle ne modifie jamais le mot de passe d'un compte existant.

7. Ouvrez **http://localhost:8088** et connectez-vous avec l'e-mail et le mot de passe de l'étape 4.

Les e-mails envoyés par l'application (invitation d'un nouveau compte, lien de réinitialisation) ne partent pas sur Internet : ils arrivent dans Mailpit, sur **http://localhost:8026**.

Pour arrêter l'application, puis la relancer plus tard :

```bash
docker compose down
```

```bash
docker compose up -d
```

Les données restent dans le volume MySQL entre deux lancements. Pour tout effacer et repartir de zéro : `docker compose down -v`.

### Lancer le projet en mode développement

Pour modifier le code avec rechargement automatique, il faut en plus **Node.js 22.18** ou plus récent et **npm 11**. Docker ne fait alors tourner que MySQL et Mailpit ; l'API et l'interface tournent sur votre machine :

```bash
docker compose up -d mysql mailpit redis
```

```bash
cd backend && cp .env.example .env && npm install && npm run db:deploy && npm run db:seed && npm run start:dev
```

```bash
cd frontend && npm install && npm run dev
```

Avant la première commande `backend`, renseignez `backend/.env` (mot de passe MySQL, secret JWT, compte administrateur) : le détail est dans [Développement local](#développement-local). L'interface est alors sur **http://localhost:5180** et la documentation de l'API sur **http://localhost:3000/api/docs**.

## Apprendre avec ce projet

Le [guide NestJS + React par la pratique](docs/guide-nestjs/README.md) explique, chapitre par chapitre, comment le code est construit et comment y ajouter des fonctionnalités.

## Sommaire

0. [Prise en main](#prise-en-main)
1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Lancer le projet avec Docker](#lancer-le-projet-avec-docker-le-plus-simple)
4. [Développement local](#développement-local)
5. [Configuration](#configuration)
6. [Base de données, migrations et seed](#base-de-données-migrations-et-seed)
7. [Modèle RBAC](#modèle-rbac)
8. [API](#api)
9. [Sécurité](#sécurité)
10. [Journaux](#journaux)
11. [Tests](#tests)
12. [Déploiement en production](#déploiement-en-production)
13. [Structure du dépôt](#structure-du-dépôt)
14. [Dépannage](#dépannage)

## Fonctionnalités

- **Authentification** : connexion, déconnexion, refresh avec rotation et détection de rejeu, mot de passe oublié et réinitialisation par lien à usage unique, `GET /api/v1/auth/me`, protection contre la force brute (blocage par couple compte + IP, verrouillage du compte en cas d'attaque distribuée, limites par IP).
- **Tableau de bord** : comptes par statut, connexions des 14 derniers jours, comptes par rôle, dernières actions, tout calculé par l'API.
- **Utilisateurs** : création par invitation (e-mail envoyé en arrière-plan par une file BullMQ, avec la liste des rôles attribués, puis un e-mail à chaque changement de rôles ; aucun mot de passe saisi ni vu par un administrateur), modification, statut (actif, inactif, verrouillé), suppression logique, envoi d'un lien de réinitialisation, multi-rôles, recherche, filtres, tri et pagination côté serveur, fiche à onglets (profil, rôles, activité, connexions).
- **Départements** : code, nom, responsable facultatif ; chaque compte peut être rattaché à un département ; suppression refusée tant qu'il a des membres.
- **Rôles** : création, duplication, modification, suppression ; six rôles système protégés ; Super Administrator impossible à supprimer ni à modifier.
- **Permissions** : catalogue au format `module.action`, matrice à cases à cocher par rôle (par permission, par module, tout, rien).
- **Journal d'activité** immuable et filtrable, sans aucun secret ; **historique des connexions** filtrable.
- **Interface** : sidebar construite selon les permissions, responsive (tableaux en cartes sous 768 px), skeletons, états vides et erreurs, confirmation de toute action destructrice, toasts, accessibilité WCAG 2.2 AA vérifiée par axe.

## Architecture

```
Navigateur (SPA React)
  │  Authorization: Bearer <access token, 15 min, en mémoire uniquement>
  │  Cookie refresh_token (HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth)
  ▼
nginx (frontend)  ──  /api/*  ──►  API NestJS (/api/v1)
  sert la SPA                     ThrottlerGuard (limites par IP)
  en-têtes CSP                    JwtAuthGuard (refus si non authentifié)
                                  PermissionsGuard (refus par défaut)
                                  Controller → Service (règles, AccessPolicy) → Prisma
                                  Filtre d'erreurs RFC 9457, logs JSON pino
                                        │
                                        ▼
                                  MySQL 8.4 (Prisma Migrate)      Mailpit / SMTP
```

Le détail des technologies et de leurs versions est dans [Technologies utilisées](#technologies-utilisées).

Ce projet suit les règles du harness ASIN avec des dérogations accordées explicitement et consignées dans [ADR 0001](docs/adr/0001-stack-and-derogations.md) : MySQL au lieu de PostgreSQL, authentification locale au lieu de Keycloak, Axios au lieu d'openapi-fetch, class-validator au lieu de zod côté API, pagination par numéro de page, couleur primaire #2563EB et police Inter, Vitest au lieu de Jest.

## Développement local

Prérequis : Node.js 22.18 ou plus récent, npm 11, Docker.

```bash
cp .env.example .env
```

```bash
docker compose up -d mysql mailpit redis
```

```bash
cd backend && cp .env.example .env && npm install
```

Renseignez `backend/.env` (le mot de passe MySQL de `.env`, un `JWT_ACCESS_SECRET` généré, le Super Administrator), puis :

```bash
cd backend && npm run db:deploy && npm run db:seed && npm run start:dev
```

```bash
cd frontend && npm install && npm run dev
```

L'interface tourne sur http://localhost:5180 et relaie `/api` vers l'API sur le port 3000. Si ce port est déjà pris, lancez l'API avec `PORT=3100` et l'interface avec `API_PROXY_TARGET=http://localhost:3100`. La documentation Swagger est sur http://localhost:3000/api/docs. La page `/design-system` (développement uniquement) présente les tokens et les composants.

Pour les tests e2e du backend, copiez `backend/.env.example` en `backend/.env.test` en visant la base `access_manager_test` (créée par le conteneur MySQL), avec `NODE_ENV=test`, `LOG_LEVEL=silent` et `GLOBAL_THROTTLE_LIMIT=10000`.

npm 11 bloque les scripts d'installation des dépendances par défaut : seuls ceux d'argon2, de Prisma et d'esbuild sont autorisés (`allowScripts` de `backend/package.json`), celui de télémétrie de swagger-ui est refusé.

### Contrat API et types du frontend

Les types TypeScript de l'API ne sont jamais écrits à la main. Après une modification d'un DTO ou d'une réponse :

```bash
cd backend && npm run openapi:export
```

```bash
cd frontend && npm run api:generate
```

Le premier écrit [docs/architecture/openapi.json](docs/architecture/openapi.json), le second régénère `frontend/src/api/schema.d.ts`.

## Configuration

### Backend (`backend/.env`)

| Variable | Défaut | Rôle |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `PORT` | `3000` | Port HTTP de l'API |
| `DATABASE_URL` | | `mysql://user:motdepasse@hôte:3306/base` |
| `SHADOW_DATABASE_URL` | | Base de travail de `prisma migrate dev` (développement seulement) |
| `CORS_ORIGINS` | | Origines autorisées, séparées par des virgules |
| `APP_URL` | | URL publique de l'interface, utilisée dans les liens envoyés par e-mail |
| `JWT_ACCESS_SECRET` | | 43 caractères au moins ; la valeur d'exemple est refusée au démarrage |
| `JWT_ACCESS_TTL_SECONDS` | `900` | Durée de vie du jeton d'accès |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Durée de vie d'une session |
| `COOKIE_SECURE` | `true` | Cookie de refresh en `Secure` ; ne le désactivez jamais en production |
| `LOGIN_MAX_ATTEMPTS` | `5` | Échecs d'un couple compte + IP avant blocage de cette IP |
| `LOGIN_ACCOUNT_MAX_ATTEMPTS` | `50` | Échecs toutes IP confondues avant verrouillage du compte |
| `LOGIN_LOCK_MINUTES` | `15` | Fenêtre et durée des blocages |
| `AUTH_THROTTLE_LIMIT` / `AUTH_THROTTLE_TTL_SECONDS` | `10` / `60` | Limite par IP des routes d'identification |
| `GLOBAL_THROTTLE_LIMIT` | `300` | Limite par IP et par minute sur toutes les routes |
| `PASSWORD_RESET_TTL_MINUTES` | `30` | Validité des liens d'invitation et de réinitialisation |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | | Serveur d'envoi |
| `REDIS_URL` | | File de tâches BullMQ (`redis://hôte:port/base`). Une base par copie de l'API, sinon leurs workers se prennent les tâches : `/0` stack Docker, `/1` tests, `/2` API lancée sur le poste |
| `NOTIFICATION_RETRY_DELAY_MS` | `30000` | Premier délai avant une nouvelle tentative d'envoi d'e-mail (5 essais, délai doublé à chaque fois) |
| `SMTP_SECURE` / `SMTP_REQUIRE_TLS` | `false` / `false` | TLS direct ou STARTTLS obligatoire ; `SMTP_REQUIRE_TLS=true` hors poste de développement |
| `TRUST_PROXY` | `false` | `1` derrière un reverse proxy ; jamais `true` |
| `SWAGGER_ENABLED` | `true` | `false` en production |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `SEED_SUPER_ADMIN_*` | | E-mail, mot de passe (12 caractères au moins), prénom et nom du Super Administrator créé par le seed |

L'API valide toute sa configuration au démarrage et s'arrête en listant les variables manquantes ou invalides.

### Docker Compose (`.env` à la racine)

`MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_PORT` (3310), `MAILPIT_SMTP_PORT` (1026), `MAILPIT_UI_PORT` (8026), `FRONTEND_PORT` (8088), `JWT_ACCESS_SECRET`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`, `SWAGGER_ENABLED`, et en option `NODE_IMAGE` et `NGINX_IMAGE` pour construire depuis un miroir Harbor. Les ports ne sont publiés que sur `127.0.0.1`.

## Base de données, migrations et seed

Le schéma est dans [backend/prisma/schema.prisma](backend/prisma/schema.prisma) et décrit dans [docs/architecture/data-model.md](docs/architecture/data-model.md) : `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `password_reset_tokens`, `activity_logs`, `login_history`.

| Commande (dans `backend/`) | Effet |
|---|---|
| `npm run db:migrate` | Crée une migration à partir du schéma (développement) |
| `npm run db:deploy` | Applique les migrations en attente (tous environnements) |
| `npm run db:seed` | Permissions, six rôles système, Super Administrator |
| `npm run prisma:generate` | Régénère le client Prisma (`src/generated/prisma`) |

Une migration appliquée n'est jamais modifiée : tout changement de schéma passe par une nouvelle migration.

## Modèle RBAC

Un compte reçoit un ou plusieurs rôles ; ses permissions sont l'union de celles de ses rôles. Les permissions sont définies dans le code ([permission-catalog.ts](backend/src/rbac/permission-catalog.ts)) au format `module.action`.

| Permission | Super Admin | Administrator | Manager | Editor | Viewer | Auditor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `dashboard.read` | x | x | x | x | x | x |
| `users.read` | x | x | x | x | x | x |
| `users.create` | x | x | x | | | |
| `users.update` | x | x | x | x | | |
| `users.delete` | x | x | | | | |
| `users.reset_password` | x | x | x | | | |
| `users.assign_roles` | x | x | x | | | |
| `roles.read` | x | x | x | | x | x |
| `roles.create` | x | x | | | | |
| `roles.update` | x | x | | | | |
| `roles.delete` | x | | | | | |
| `permissions.read` | x | x | x | | x | x |
| `departments.read` | x | x | x | x | x | x |
| `departments.create` | x | x | | | | |
| `departments.update` | x | x | | | | |
| `departments.delete` | x | x | | | | |
| `activity_logs.read` | x | x | | | | x |
| `login_history.read` | x | x | | | | x |

Les permissions des rôles système (sauf Super Administrator) se modifient dans la matrice ; le seed les remet à leur définition s'il est relancé.

### Protéger une route

```ts
@Permissions('users.read', 'users.update')                  // toutes sont requises (ET, par défaut)
@Permissions.anyOf('activity_logs.read', 'login_history.read') // une seule suffit (OU, explicite)
@Authenticated()                                            // tout compte connecté, quels que soient ses rôles
@Public()                                                   // aucune authentification (connexion, santé)
```

Une route sans aucun de ces décorateurs répond 403 à tout le monde, Super Administrator compris : c'est le refus par défaut. Une clé de permission inconnue est refusée à la compilation.

Dans un service, `RbacService.hasPermission(userId, permission)` répond à partir des rôles en base d'un compte actif et non supprimé.

### Règles d'accès par ressource

Elles sont appliquées par [AccessPolicy](backend/src/rbac/access-policy.service.ts) avant toute écriture :

- personne ne modifie ses propres rôles, ni le statut, la suppression ou le mot de passe de son propre compte ;
- on ne peut attribuer, retirer ou accorder que des rôles et permissions que l'on détient soi-même ;
- on ne peut gérer un compte que si l'on détient toutes ses permissions, et seul un Super Administrator gère un autre Super Administrator ;
- le dernier Super Administrator actif ne peut être ni désactivé, ni supprimé, ni privé de son rôle ;
- les rôles système ne se renomment ni ne se suppriment, et les permissions du Super Administrator sont figées ; un rôle encore attribué ne se supprime pas.

## API

Toutes les routes sont sous `/api/v1`. Champs JSON en snake_case, dates ISO 8601 UTC.

- **Listes** : `{ items, total, page, page_size }` ; paramètres `page`, `page_size` (100 au maximum), `sort`, `order`, et filtres propres à chaque ressource.
- **Erreurs** : `application/problem+json` (RFC 9457) avec `type`, `title`, `status`, `detail`, `instance`, et `errors[]` (`field`, `rule`, `message`) pour la validation. Aucune trace ni détail interne.
- **Corrélation** : chaque réponse porte un `X-Request-Id`, repris de la requête s'il est sûr.

| Ressource | Routes |
|---|---|
| Authentification | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Utilisateurs | `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, `PUT /users/:id/roles`, `POST /users/:id/reset-password`, `DELETE /users/:id` |
| Départements | `GET /departments`, `GET /departments/:id`, `POST /departments`, `PATCH /departments/:id`, `DELETE /departments/:id` |
| Rôles | `GET /roles`, `GET /roles/:id`, `POST /roles`, `POST /roles/:id/duplicate`, `PATCH /roles/:id`, `PUT /roles/:id/permissions`, `DELETE /roles/:id` |
| Lecture | `GET /permissions`, `GET /activity-logs`, `GET /login-history`, `GET /dashboard` |
| Exploitation | `GET /health` (public : `{ "status": "ok" }` ou 503) |

Le contrat complet est dans Swagger (`/api/docs` quand `SWAGGER_ENABLED=true`) et dans [docs/architecture/openapi.json](docs/architecture/openapi.json).

## Sécurité

- **Mots de passe** : Argon2id ; 12 caractères au minimum ; aucun mot de passe n'est créé ni vu par un administrateur (invitation par lien).
- **Sessions** : jeton d'accès de 15 minutes gardé en mémoire par le navigateur ; refresh token opaque de 256 bits, stocké haché (SHA-256), renouvelé à chaque usage ; un refresh token réutilisé révoque toute la session. Déconnexion, désactivation, suppression et réinitialisation coupent l'accès immédiatement.
- **Force brute et énumération** : blocage par couple compte + IP, verrouillage du compte au-delà de 50 échecs toutes IP confondues, limites par IP, message d'échec identique et coût Argon2 constant que le compte existe ou non.
- **Requêtes** : validation déclarative de chaque entrée (champs inconnus refusés), requêtes paramétrées, corps limité à 100 ko, Helmet, CORS en liste blanche, CSP stricte côté nginx.
- **Traçabilité** : actions métier et événements de sécurité (`auth.logout`, `auth.session_revoked`, `auth.login_blocked`, `auth.account_locked`, `auth.password_reset`) dans le journal d'activité, secrets masqués à toute profondeur.

La revue de sécurité de la phase 8 et le suivi de ses constats sont dans [docs/security/security-review.md](docs/security/security-review.md).

## Journaux

L'API écrit une ligne JSON par requête sur la sortie standard (pino), en anglais, avec le niveau, le correlation id (`reqId`), la méthode, le chemin sans query string, le statut et la durée. Aucun en-tête, corps ou paramètre de recherche n'est journalisé : ni jeton, ni mot de passe, ni e-mail. Les erreurs serveur sont journalisées avec leur trace, qui n'est jamais renvoyée au client.

## Tests

| Commande | Contenu |
|---|---|
| `cd backend && npm test` | Tests unitaires (Vitest) |
| `cd backend && npm run test:e2e` | 101 tests Supertest sur une vraie base MySQL de test |
| `cd backend && npm run test:cov` | Couverture de la suite e2e |
| `cd frontend && npm run test:unit` | Tests unitaires (node:test) |
| `cd frontend && npm run test:a11y` | Accessibilité axe sur 11 écrans |
| `cd frontend && npm run test:e2e` | Parcours complets (administrateur, compte invité via Mailpit, console sans erreur ni violation CSP) |
| `cd frontend && node scripts/i18n-check.mjs` | Clés de traduction complètes |

Les suites Playwright demandent l'API sur le port 3000, Mailpit, et le Super Administrator du seed dans `E2E_EMAIL` et `E2E_PASSWORD`. Avec `PLAYWRIGHT_BASE_URL=http://localhost:8088`, elles visent la stack Docker (build de production derrière nginx et sa CSP) au lieu du serveur de développement. La correspondance entre exigences et tests est dans [docs/tests.md](docs/tests.md).

## Déploiement en production

- **Images** : construites depuis [backend/Dockerfile](backend/Dockerfile) et [frontend/Dockerfile](frontend/Dockerfile), poussées sur Harbor ; les images de base se passent par `--build-arg NODE_IMAGE=… NGINX_IMAGE=…` pointant le miroir Harbor. Conteneurs non root, healthchecks intégrés (`/api/v1/health`, `/healthz`).
- **TLS** : terminé par l'ingress ; le cookie `Secure` l'exige. Activez HSTS à ce niveau.
- **Proxy** : `TRUST_PROXY=1` (ou le nombre de proxys en amont) pour que limites et journaux voient l'IP du client ; le nginx du frontend réécrit `X-Forwarded-For`.
- **Migrations** : `npx prisma migrate deploy` avant le démarrage de la nouvelle version (commande du conteneur en Compose, Job ou initContainer sous Kubernetes) ; le seed s'exécute une fois à l'installation.
- **Secrets** : `JWT_ACCESS_SECRET`, mots de passe MySQL et SMTP fournis par OpenBao ou des Secrets Kubernetes, jamais dans une image ni dans le dépôt. Changer `JWT_ACCESS_SECRET` invalide les jetons d'accès en cours, pas les sessions.
- **Réglages** : `SWAGGER_ENABLED=false`, `SMTP_REQUIRE_TLS=true`, `LOG_LEVEL=info`, `CORS_ORIGINS` et `APP_URL` sur l'URL publique.
- **Mise à l'échelle** : les compteurs de limite par IP sont en mémoire, donc propres à chaque réplique ; au-delà d'une réplique, prévoir un stockage partagé (Redis).
- **Données personnelles** : `login_history` conserve l'adresse saisie à chaque tentative et l'IP. Définissez une durée de rétention (par exemple 12 mois) et une purge planifiée ; le journal d'activité ne contient pas de mot de passe ni de jeton.
- **Sauvegardes** : volume MySQL sauvegardé et restauration testée.

## Structure du dépôt

```
access-manager/
├── docker-compose.yml          MySQL, Mailpit, API, frontend
├── docker/mysql/init/          bases de test et shadow
├── docs/
│   ├── adr/                    décisions et dérogations
│   ├── architecture/           modèle de données, interface, contrat OpenAPI
│   ├── security/               revue de sécurité
│   └── tests.md                matrice exigences vers tests
├── backend/
│   ├── prisma/                 schéma, migrations, seed
│   ├── src/
│   │   ├── auth/               connexion, refresh, mot de passe, JWT
│   │   ├── rbac/               catalogue, guards, décorateurs, AccessPolicy
│   │   ├── users/  roles/  permissions/
│   │   ├── activity-logs/  login-history/  dashboard/  health/
│   │   ├── common/             erreurs, pagination, journaux, limites
│   │   └── config/             validation de l'environnement
│   └── test/                   tests e2e
└── frontend/
    ├── nginx.conf              service de la SPA et relais /api
    ├── src/
    │   ├── api/                client, types générés, hooks, erreurs
    │   ├── app/                session, routes, guards
    │   ├── components/         ui (shadcn), layout, data
    │   ├── features/           un dossier par écran
    │   └── locales/            fr (source) et en
    └── tests/                  accessibilité et parcours Playwright
```

## Dépannage

| Symptôme | Cause et solution |
|---|---|
| L'API s'arrête avec « Invalid environment configuration » | Une variable manque ou est invalide ; le message la nomme. Le secret JWT d'exemple est refusé. |
| Connexion impossible après plusieurs essais | Blocage du couple compte + IP pendant 15 minutes ; un administrateur peut réactiver un compte verrouillé depuis sa fiche. |
| Session perdue avec deux onglets | Deux refresh simultanés passent pour un rejeu et ferment la session : l'interface les regroupe, mais un client tiers doit faire de même. |
| Toutes les requêtes semblent venir de la même IP | `TRUST_PROXY` n'est pas réglé derrière le proxy. |
| Aucun e-mail reçu | En local, consultez Mailpit (http://localhost:8026) ; ailleurs, vérifiez `SMTP_*` et les journaux de l'API. |
| `Can't reach database server` | MySQL n'est pas prêt ou `DATABASE_URL` vise le mauvais hôte (`mysql` dans Compose, `127.0.0.1:3310` depuis la machine). |

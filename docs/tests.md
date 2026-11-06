# Stratégie et matrice de tests

## Suites

| Suite | Outil | Commande | Contenu |
|---|---|---|---|
| Backend unitaire | Vitest | `cd backend && npm test` | 23 tests : filtre d'erreurs RFC 9457, validation de la configuration, correlation id, catalogue des permissions, service d'e-mail, jetons opaques |
| Backend e2e | Vitest + Supertest, MySQL `access_manager_test` | `cd backend && npm run test:e2e` | 101 tests sur la vraie base de test, migrations appliquées avant la suite |
| Backend couverture | v8 | `cd backend && npm run test:cov` | 97,5 % des lignes, 81,6 % des branches (suite e2e) |
| Frontend unitaire | node:test | `cd frontend && npm run test:unit` | 16 tests : helpers de saisie, traduction des erreurs API, regroupement des permissions |
| Frontend accessibilité | Playwright + axe | `cd frontend && npm run test:a11y` | 11 écrans, aucune violation sérieuse ou critique (WCAG 2.2 AA) |
| Frontend parcours | Playwright | `cd frontend && npm run test:e2e` | 3 parcours de bout en bout sur l'API réelle et Mailpit, dont une console sans erreur ni violation CSP |

Les suites Playwright demandent l'API sur le port 3000, Mailpit (`docker compose up -d mysql mailpit redis`) et les identifiants du Super Administrator du seed dans `E2E_EMAIL` et `E2E_PASSWORD`. Avec `PLAYWRIGHT_BASE_URL=http://localhost:8088`, elles s'exécutent contre la stack Docker complète (14 tests verts en phase 10).

## Exigences du cahier des charges

| Exigence | Tests |
|---|---|
| Login, refresh avec rotation, logout, `GET /auth/me` | `auth.e2e-spec.ts` : login, me, refresh, logout ; `admin-journey.spec.ts` |
| Refresh token : cookie HttpOnly/Secure/SameSite, haché, révocation sur rejeu | `auth.e2e-spec.ts` : cookie durci et SHA-256, rejeu qui révoque la session, refresh concurrent ; `hardening.e2e-spec.ts` : événement `auth.session_revoked` |
| Mot de passe oublié et réinitialisation | `auth.e2e-spec.ts` : password reset ; `invited-viewer.spec.ts` : lien reçu par e-mail réel |
| Protection contre la force brute | `auth.e2e-spec.ts` : brute force (compte + IP, attaque distribuée, Super Administrator) ; `auth-rate-limit.e2e-spec.ts` : 429 sur les routes d'identification et limite globale |
| Pas d'énumération des comptes | `auth.e2e-spec.ts` : même problème pour un mauvais mot de passe et un e-mail inconnu ; `forgot-password` 202 dans les deux cas |
| RBAC : refus par défaut, `@Public`, `@Authenticated`, ET et OU | `rbac.e2e-spec.ts` : guards |
| Rôles et permissions relus côté serveur | `rbac.e2e-spec.ts` : retrait de rôle en cours de session, rôle supprimé ; `roles.e2e-spec.ts` : matrice appliquée immédiatement |
| `hasPermission(userId, permission)` | `rbac.e2e-spec.ts` : RbacService.hasPermission |
| Interdiction de l'auto-élévation | `rbac.e2e-spec.ts` : AccessPolicy ; `users.e2e-spec.ts` : PUT /users/:id/roles ; `roles.e2e-spec.ts` : permissions non détenues |
| Prise de compte d'un compte plus puissant | `users.e2e-spec.ts` : account takeover |
| Rôles système protégés, Super Administrator non supprimable | `roles.e2e-spec.ts` : system roles |
| Dernier Super Administrator | `rbac.e2e-spec.ts` : refuses to remove the last active Super Administrator |
| Doublons (e-mail, nom de rôle) | `seed.e2e-spec.ts`, `users.e2e-spec.ts`, `roles.e2e-spec.ts` |
| Utilisateurs : CRUD, statut, recherche, filtres, tri, pagination serveur | `users.e2e-spec.ts` |
| Rôles : CRUD, duplication | `roles.e2e-spec.ts` |
| E-mails d'invitation et de changement de rôles (événement, file, nouvelles tentatives, idempotence) | `notifications.e2e-spec.ts` ; `mail.service.spec.ts` |
| Départements : CRUD, doublons, membres, responsable | `departments.e2e-spec.ts` ; `tests/e2e/departments.spec.ts` (interface) |
| Journal d'activité immuable, sans secret, filtrable | `reporting.e2e-spec.ts` ; `hardening.e2e-spec.ts` |
| Historique des connexions | `auth.e2e-spec.ts` : login history ; `reporting.e2e-spec.ts` |
| Dashboard servi par l'API | `reporting.e2e-spec.ts` : GET /dashboard |
| Logs sans secret ni donnée personnelle, correlation id | `logging.e2e-spec.ts` ; `hardening.e2e-spec.ts` ; `logger.config.spec.ts` |
| Erreurs RFC 9457 sans détail interne | `problem-details.spec.ts` ; `hardening.e2e-spec.ts` : errors |
| Santé et déploiement | `health.e2e-spec.ts` ; suites Playwright contre la stack Docker |
| Seed : permissions, six rôles, Super Admin depuis l'environnement | `seed.e2e-spec.ts` ; `permission-catalog.spec.ts` |
| Sidebar selon les permissions, le backend seule barrière | `invited-viewer.spec.ts` (interface) ; suites RBAC backend (barrière réelle) |
| Jeton d'accès en mémoire uniquement | `admin-journey.spec.ts` : aucun JWT en localStorage ni sessionStorage après rechargement |
| Accessibilité, responsive | `tests/a11y/screens.spec.ts` ; `scripts/responsive-check.mjs` (preuve 2 des règles UI) |

## Défauts trouvés par les tests

- Phase 7 : toasts perdus après remontage d'un composant (callbacks de `mutate`), contraste insuffisant, nom accessible du menu de compte.
- Phase 8 : prise de compte d'un compte plus puissant, verrouillage à distance.
- Phase 9 : les booléens d'environnement à `false` étaient lus `true` (dont `SWAGGER_ENABLED` et `COOKIE_SECURE`) ; `env.validation.ts` dépendait d'un polyfill chargé ailleurs.

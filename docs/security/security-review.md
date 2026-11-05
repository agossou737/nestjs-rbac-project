# Revue de sécurité : phase 8

- Date : 2026-11-05
- Périmètre : `backend/src` (auth, RBAC, modules métier, configuration), `frontend/src/api/client.ts`, `frontend/src/app/session.tsx`
- Méthode : revue indépendante par un agent de sécurité (lecture seule), puis correctifs écrits en TDD (test rouge, puis vert)

## Constats et traitement

| # | Gravité | Constat | Statut |
|---|---|---|---|
| 1 | Haute | Un détenteur de `users.update` pouvait changer l'e-mail d'un compte plus puissant, puis réinitialiser son mot de passe et en prendre le contrôle | Corrigé : pour gérer le compte d'autrui (profil, statut, suppression, réinitialisation), il faut détenir toutes ses permissions. Un changement d'e-mail révoque les sessions et les liens de réinitialisation en attente. Tests : `users.e2e-spec.ts`, « account takeover » |
| 2 | Moyenne | Pas de `trust proxy` : derrière l'ingress, toutes les requêtes partagent l'IP du proxy (limites et journaux faussés) | Corrigé : variable `TRUST_PROXY` (nombre de sauts), jamais `true` |
| 3 | Moyenne | Verrouillage à distance d'un compte : 5 mauvais mots de passe par quart d'heure suffisent à bloquer n'importe qui, Super Administrator compris | Corrigé (décision utilisateur) : 5 échecs bloquent le couple compte + IP pendant 15 minutes glissantes, sans gêner le titulaire ailleurs ; le compte entier ne se verrouille qu'après `LOGIN_ACCOUNT_MAX_ATTEMPTS` échecs (50) toutes IP confondues. Événements `auth.login_blocked` et `auth.account_locked`. Tests : `auth.e2e-spec.ts`, « brute force » |
| 4 | Moyenne | Le secret JWT d'exemple passait la validation | Corrigé : 43 caractères minimum, la valeur `change-me…` est refusée au démarrage |
| 5 | Faible | Double utilisation concurrente d'un lien de réinitialisation | Corrigé : le jeton est réclamé atomiquement dans la transaction |
| 6 | Faible | Course possible sur la règle du dernier Super Administrator (deux retraits simultanés) | Accepté : le blocage de l'auto-gestion rend le cas très improbable ; à traiter par verrou de ligne si besoin |
| 7 | Faible | Écart de temps de réponse sur « mot de passe oublié » selon que le compte existe | Accepté : quelques millisecondes, limite de 10 requêtes par minute et par IP |
| 8 | Faible | Swagger toujours exposé, SMTP sans TLS imposé, rétention de `login_history` non définie | Corrigé pour Swagger (`SWAGGER_ENABLED`) et SMTP (`SMTP_SECURE`, `SMTP_REQUIRE_TLS`) ; rétention à définir en phase 10 |

## Mesures ajoutées en phase 8

- Journaux applicatifs JSON (pino), une ligne par requête, avec correlation id (`X-Request-Id`, repris s'il est sûr, sinon généré). Ni en-têtes, ni corps, ni query string : aucun jeton, mot de passe, e-mail ou terme de recherche. Vérifié par `logging.e2e-spec.ts`.
- Événements de sécurité dans le journal d'activité : `auth.logout`, `auth.session_revoked` (rejeu d'un refresh token), `auth.login_blocked` (blocage d'une IP sur un compte), `auth.account_locked`, `auth.password_reset`.
- Limite globale par IP sur toutes les routes (`GLOBAL_THROTTLE_LIMIT`), en plus de la limite stricte des routes d'identification ; le rate limit s'applique avant toute lecture en base.
- Dépendances de production : `npm audit --omit=dev` sans vulnérabilité (backend et frontend). Restent 2 alertes modérées (backend) et 6 (frontend) dans les outils de développement (minimatch via la CLI Nest et la CLI shadcn), non livrés.

## Points vérifiés sains

Refus par défaut et permissions relues en base à chaque requête, JWT HS256 épinglé et session vérifiée, Argon2id, jetons opaques stockés hachés avec rotation et détection de rejeu, cookie `HttpOnly; Secure; SameSite=Strict` limité à `/api/v1/auth`, CORS en liste blanche, `forbidNonWhitelisted` contre l'affectation de masse, requêtes paramétrées (seul `$queryRaw` du dashboard, en template paramétré), erreurs RFC 9457 sans détail interne, jeton d'accès en mémoire côté navigateur.

# Modèle de données : Access Manager

Source : `backend/prisma/schema.prisma`, migrations `backend/prisma/migrations/` (`init`, puis `add_departments`). MySQL 8.4, jeu de caractères utf8mb4, collation `utf8mb4_unicode_ci` (comparaisons insensibles à la casse). Les colonnes sont en snake_case et les identifiants sont des UUID (`CHAR(36)`).

## Tables

| Table | Rôle | Contraintes et index |
|---|---|---|
| `users` | Comptes | `email` unique (insensible à la casse, conservé après suppression logique) ; index `(status, deleted_at)`, `(last_name, first_name)`, `created_at` |
| `departments` | Unités organisationnelles | `code` et `name` uniques (renommés à la suppression logique pour être réutilisables) ; `manager_id` vers `users` (`SET NULL`) ; les comptes y sont rattachés par `users.department_id` (`RESTRICT`), index `deleted_at`, `manager_id` |
| `roles` | Rôles | `name` unique ; `is_system` protège les six rôles du seed ; index `deleted_at` |
| `permissions` | Catalogue `module.action` | `key` unique, `(module, action)` unique ; pas de suppression logique (référentiel porté par le code) |
| `user_roles` | Multi-rôles | clé primaire `(user_id, role_id)`, index `role_id` ; `assigned_by_id` trace l'auteur de l'attribution |
| `role_permissions` | Matrice | clé primaire `(role_id, permission_id)`, index `permission_id` |
| `refresh_tokens` | Sessions | `token_hash` unique (SHA-256, jamais le jeton en clair), `family_id` pour la détection de rejeu, `replaced_by_id` pour la chaîne de rotation ; index `(user_id, revoked_at)`, `family_id`, `expires_at` |
| `password_reset_tokens` | Mot de passe oublié | `token_hash` unique, usage unique (`used_at`), expiration |
| `activity_logs` | Journal immuable | aucune route de modification ni de suppression ; `metadata` JSON nettoyé des secrets ; index `created_at`, `(actor_id, created_at)`, `(action, created_at)`, `(entity_type, entity_id)` |
| `login_history` | Historique des connexions | succès et échecs (`outcome`), e-mail saisi même sans compte correspondant ; index `created_at`, `(user_id, created_at)`, `(outcome, created_at)` |

## Suppression

- **Logique** pour `users` et `roles` (`deleted_at`). Les lectures métier filtrent `deleted_at IS NULL`.
- **En cascade** : les rôles, les sessions et les jetons de réinitialisation d'un utilisateur supprimé physiquement disparaissent avec lui.
- **Bloquée (`RESTRICT`)** : on ne peut pas supprimer physiquement un rôle encore attribué, ni une permission utilisée par un rôle.
- **`SET NULL`** : le journal d'activité et l'historique des connexions survivent à la suppression de l'acteur.

## Seed

`npm run db:seed` (idempotent) :

- **Permissions** : les 18 permissions de `src/rbac/permission-catalog.ts`.
- **Rôles système** (`is_system = 1`) :

  | Rôle | Permissions |
  |---|---|
  | Super Administrator | 18 |
  | Administrator | 17 (toutes sauf `roles.delete`) |
  | Manager | 9 |
  | Auditor | 7 |
  | Viewer | 5 |
  | Editor | 4 |

  Les permissions des rôles système sont resynchronisées à chaque exécution.
- **Super Admin** : créé à partir de `SEED_SUPER_ADMIN_*`. Mot de passe d'au moins 12 caractères, haché en Argon2id. Un compte existant n'est jamais modifié.

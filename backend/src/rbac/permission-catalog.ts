// Single source of the permission keys (module.action). The seed writes them to the database and the
// @Permissions() decorator only accepts these keys, so a typo fails at compile time.
export const PERMISSIONS = [
  { key: 'dashboard.read', description: 'Consulter le tableau de bord' },
  { key: 'users.read', description: 'Consulter les utilisateurs' },
  { key: 'users.create', description: 'Créer un utilisateur' },
  { key: 'users.update', description: 'Modifier un utilisateur et son statut' },
  { key: 'users.delete', description: 'Supprimer un utilisateur' },
  { key: 'users.reset_password', description: "Réinitialiser le mot de passe d'un utilisateur" },
  { key: 'users.assign_roles', description: 'Attribuer ou retirer des rôles' },
  { key: 'roles.read', description: 'Consulter les rôles' },
  { key: 'roles.create', description: 'Créer ou dupliquer un rôle' },
  { key: 'roles.update', description: "Modifier un rôle et ses permissions" },
  { key: 'roles.delete', description: 'Supprimer un rôle' },
  { key: 'permissions.read', description: 'Consulter le catalogue des permissions' },
  { key: 'departments.read', description: 'Consulter les départements' },
  { key: 'departments.create', description: 'Créer un département' },
  { key: 'departments.update', description: 'Modifier un département et son responsable' },
  { key: 'departments.delete', description: 'Supprimer un département' },
  { key: 'activity_logs.read', description: "Consulter le journal d'activité" },
  { key: 'login_history.read', description: "Consulter l'historique des connexions" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

export function isPermissionKey(key: string): key is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(key);
}

export const SUPER_ADMIN_ROLE = 'Super Administrator';

type SystemRole = { name: string; description: string; permissions: readonly PermissionKey[] };

const READ_DIRECTORY: PermissionKey[] = ['dashboard.read', 'users.read', 'roles.read', 'permissions.read', 'departments.read'];

export const SYSTEM_ROLES: readonly SystemRole[] = [
  {
    name: SUPER_ADMIN_ROLE,
    description: "Tous les droits. Rôle protégé, impossible à supprimer.",
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    name: 'Administrator',
    description: 'Administration complète, sauf la suppression des rôles.',
    permissions: ALL_PERMISSION_KEYS.filter((key) => key !== 'roles.delete'),
  },
  {
    name: 'Manager',
    description: 'Gestion des comptes utilisateurs et de leurs rôles.',
    permissions: [
      ...READ_DIRECTORY,
      'users.create',
      'users.update',
      'users.reset_password',
      'users.assign_roles',
    ],
  },
  {
    name: 'Editor',
    description: 'Mise à jour des fiches utilisateurs.',
    permissions: ['dashboard.read', 'users.read', 'users.update', 'departments.read'],
  },
  {
    name: 'Viewer',
    description: 'Consultation des utilisateurs, rôles et permissions.',
    permissions: READ_DIRECTORY,
  },
  {
    name: 'Auditor',
    description: "Consultation et accès au journal d'activité et à l'historique des connexions.",
    permissions: [...READ_DIRECTORY, 'activity_logs.read', 'login_history.read'],
  },
];

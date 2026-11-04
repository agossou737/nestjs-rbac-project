# Interface utilisateur : Access Manager

## 0. Direction de design

| ECR | Public et ton | Type d'écran | V / M / D | Patron | Élément mémorable | Écarts justifiés |
|---|---|---|---|---|---|---|
| ECR-001 Connexion, ECR-002 Mot de passe oublié, ECR-003 Réinitialisation | Tout agent habilité qui ouvre l'outil ; ton sobre et rassurant, messages d'erreur précis sans révéler si un compte existe | Citizen procedure (form, case tracking) | 2 / 1 / 3 | 1. Online procedure in steps (version courte, une étape) | Le nom de l'application et sa pastille clé sur fond `primary`, seul bloc coloré de l'écran | aucun |
| ECR-004 Tableau de bord | Administrateurs et auditeurs qui surveillent l'état des accès ; ton factuel, chiffres réels de l'API | Dashboard | 2 / 1 / 6 | 4. Dashboard | Le nombre de comptes actifs en indicateur dominant (`text-3xl`, chiffres alignés), les autres indicateurs plus petits | aucun |
| ECR-005 Utilisateurs (liste), ECR-006 Fiche utilisateur à onglets, ECR-007 Rôles (liste et édition), ECR-009 Journal d'activité, ECR-010 Historique des connexions | Administrateurs qui traitent des comptes au quotidien ; ton direct, vocabulaire métier (compte, rôle, permission) | Agent back-office (tables, bulk entry) | 1 / 1 / 7 | 3. Back-office list and entry | Les clés de permission `module.action` en IBM Plex Mono, partout où un droit apparaît | aucun |
| ECR-008 Matrice des permissions | Administrateurs qui composent un rôle ; ton précis, chaque case est une décision de sécurité | Agent back-office (tables, bulk entry) | 1 / 1 / 7 | 3. Back-office list and entry | La matrice elle-même : modules en lignes, actions en colonnes, clés en `font-mono`, cases cochées sur `primary` | aucun |

Dérogation au thème ASIN (ADR 0001) : primaire #2563EB et police Inter à la place de #4471C4 et Public Sans, dans `frontend/src/styles/theme.access-manager.css`. IBM Plex Mono reste la police des identifiants.

### Vérifications anti-cliché

À cocher sur la passe de détail de chaque écran (phase 7) :

- [ ] 1. Pas de rangée réflexe de trois cartes égales
- [ ] 2. Pas de titre générique
- [ ] 3. Pas de vignette ou d'icône répétée à l'identique
- [ ] 4. Pas de dégradé, lueur, ombre colorée ou flou
- [ ] 5. Aucun chiffre inventé : tout vient de l'API
- [ ] 6. Pas d'emoji, pas de pictogramme sans fonction
- [ ] 7. Jamais deux boutons pleins visibles en même temps
- [ ] 8. Pas de texte centré au-delà de deux lignes
- [ ] 9. Élément mémorable construit avec le design system
- [ ] 10. Hiérarchie lisible : un élément domine chaque section

## 1. Design system

| Rôle | Token | Valeur |
|---|---|---|
| Action principale, lien, focus | `primary`, `ring` | #2563EB |
| Fond de page | `background` | #F8FAFC |
| Surfaces (cartes, sidebar, barre du haut) | `card`, `sidebar` | #FFFFFF |
| Texte | `foreground` | #111827 |
| Texte secondaire | `muted-foreground` | #64748B |
| Bordures de surfaces | `border` | #E2E8F0 |
| Bordure des champs (contraste 3:1) | `input` | valeur ASIN |
| Succès, alerte, erreur | `success`, `warning`, `destructive` | valeurs ASIN |

Typographie : `text-3xl font-semibold` (indicateur dominant), `text-2xl font-semibold` (titre de page), `text-xl font-medium` (titre de section), `text-base` (corps), `text-sm text-muted-foreground` (secondaire), `font-mono text-sm` (clés de permission, identifiants).

Règles de composition :

- Une seule action principale (`Button` par défaut) par vue ; les autres en `outline` ou `ghost`.
- Toute action destructrice passe par un `AlertDialog` ; le retour se fait par un toast Sonner.
- Chaque écran a ses quatre états : `Skeleton` à la forme du contenu, `Empty` avec une action, `Alert` destructive avec « Réessayer », contenu.
- Cibles tactiles de 44 px sous `sm` : `min-h-11` sur `Button` et `Input`, `size-11 sm:size-4` sur `Checkbox`.
- La sidebar n'affiche que les entrées dont l'utilisateur a la permission ; l'API reste la seule barrière.
- Page de référence : `/design-system`, montée en développement uniquement.

## Composants

| Composant | Origine | Recherche shadcn | Justification |
|---|---|---|---|
| AppShell | composition (SidebarProvider, SidebarInset, SidebarTrigger, Separator) | Sidebar | mise en page commune à tous les écrans authentifiés |
| AppSidebar | composition (Sidebar, SidebarMenu, SidebarGroup) | Sidebar | navigation groupée par domaine, filtrée par permission |
| PageHeader | composition (titre, description, zone d'actions) | aucun composant dédié | en-tête identique sur chaque écran |
| ModulePendingPage | composition (Empty) | Empty | temporaire : remplacé par les écrans réels en phase 7 |

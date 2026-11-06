# 03. Côté React : du contrat OpenAPI à l'écran

Le chapitre 02 a ajouté les départements à l'API. Celui-ci les amène jusqu'à l'utilisateur : types générés, appels réseau, cache, liste, formulaire, sélecteur avec recherche, tests. Dans un gros projet React, vous ferez ce trajet pour chaque fonctionnalité.

Fichiers à ouvrir : `frontend/src/api/` (`endpoints.ts`, `queries.ts`, `mappers.ts`), `frontend/src/features/departments/`, `frontend/src/features/users/department-select.tsx`, `frontend/tests/e2e/departments.spec.ts`.

## 1. Du contrat aux types, sans rien écrire à la main

```bash
cd backend && npm run openapi:export     # docs/architecture/openapi.json
cd ../frontend && npm run api:generate   # src/api/schema.d.ts
```

Le frontend ne déclare jamais lui-même la forme d'une réponse. Il la déduit du fichier généré :

```ts
// src/api/endpoints.ts
type Query<Op extends keyof operations> = NonNullable<operations[Op]["parameters"]["query"]>;
export type DepartmentListQuery = Query<"DepartmentsController_list">;

// src/api/mappers.ts
export type Department = S["DepartmentResponse"];
```

`DepartmentsController_list` est le nom que Swagger donne à la méthode `list` du contrôleur. Si le backend renomme un champ, `api:generate` change le type, et chaque écran qui l'utilise cesse de compiler. Une erreur de contrat devient une erreur de build, pas un bug en production.

## 2. La couche réseau : un seul endroit

```ts
export const departmentsApi = {
  list: (params: DepartmentListQuery) => data(http.get<S["DepartmentPageResponse"]>("/departments", { params })),
  create: (body: S["CreateDepartmentDto"]) => data(http.post<S["DepartmentResponse"]>("/departments", body)),
  ...
};
```

Aucun composant n'appelle `axios` ou `fetch` directement. `http` (`src/api/client.ts`) ajoute le jeton, rejoue une fois la requête après un refresh si l'API répond 401, et ne garde le jeton qu'en mémoire. Si demain l'authentification change, un seul fichier bouge.

## 3. TanStack Query : le cache des données serveur

```ts
export const queryKeys = {
  departments: (query?: DepartmentListQuery) => ["departments", "list", query] as const,
};

export const useDepartments = (query: DepartmentListQuery, enabled = true) =>
  useQuery({ queryKey: queryKeys.departments(query), queryFn: () => departmentsApi.list(query), placeholderData: keepPreviousData, enabled });
```

- **La clé** identifie la donnée en cache. Elle commence par la ressource (`"departments"`) : invalider `["departments"]` rafraîchit toutes les pages et tous les filtres d'un coup.
- **`keepPreviousData`** garde la page affichée pendant le chargement de la suivante, ce qui évite le clignotement à chaque clic sur « Suivant ».
- **`enabled`** suspend une requête tant qu'elle n'a pas de sens.

Les écritures passent par `useInvalidating` :

```ts
const afterDepartmentWrite = [["departments"], ["users"], ["activity-logs"]];
export const useCreateDepartment = () => useInvalidating(departmentsApi.create, afterDepartmentWrite);
```

La liste dit **ce que l'écriture rend obsolète**. Créer un département change la liste des départements, la liste des comptes (le filtre par département) et le journal d'activité. À l'inverse, `afterUserWrite` invalide maintenant `["departments"]`, parce que déplacer un compte change le nombre de membres. Oublier une entrée ici est la source la plus fréquente d'« écran pas à jour ».

Piège rencontré dans ce projet : les callbacks passés à `mutate(..., { onSuccess })` ne s'exécutent pas si le composant est démonté entre-temps. C'est le cas d'une ligne de tableau qui disparaît après une suppression. Utilisez `await mutation.mutateAsync(...)` dans un gestionnaire `async` (voir `DepartmentActions`).

## 4. Brancher l'écran : route, menu, permission

```ts
// src/app/router.tsx
screen("/departments", "departments.read", () => import("@/features/departments/departments-page")),

// src/components/layout/nav-config.ts
{ key: "departments", to: "/departments", icon: Building2, permission: "departments.read" },
```

`screen()` charge l'écran à la demande (un fichier JavaScript par écran), lui donne son propre écran d'erreur et le protège par une permission. Le menu masque l'entrée à qui ne l'a pas. Ces protections servent le confort de l'utilisateur ; la sécurité reste dans l'API (chapitre 01).

## 5. L'écran de liste

`departments-page.tsx` reprend exactement le patron des autres listes. Apprenez-le une fois, il revient partout :

- **L'état dans l'URL** (`useListParams`) : page, tri et recherche sont dans `?search=…&sort=code`. Un lien partagé ou le bouton Retour retrouve la même vue. C'est aussi ce qui permet au lien « 3 membres » d'ouvrir `/users?department_id=…` : l'écran des comptes sait déjà lire ce filtre.
- **La recherche différée** : `setTimeout` de 300 ms avant de modifier l'URL, pour ne pas interroger l'API à chaque frappe.
- **Les quatre états** : chargement (`RowsSkeleton`), erreur (`QueryError` avec « Réessayer »), vide (`EmptyState`, avec deux variantes selon qu'un filtre est actif ou non), contenu.
- **Tableau au-dessus de 768 px, cartes en dessous** : deux rendus des mêmes données, `hidden md:block` et `md:hidden`.
- **Une seule action principale** : quand la liste est vide, le bouton « Créer » quitte l'en-tête pour l'état vide.

## 6. Le formulaire

`department-form-dialog.tsx` sert à la création comme à la modification : la présence de `department` décide du mode.

```ts
const schema = z.object({
  code: z.string().regex(/^[A-Z0-9_-]{2,20}$/, { message: "departments.errors.code_format" }),
  ...
  manager: z.object({ id: z.string(), label: z.string() }).nullable(),
});
```

- **Le schéma Zod reprend les règles du DTO** pour répondre plus vite, mais le serveur reste l'autorité. Les messages sont des clés de traduction, jamais des phrases.
- **Transformer à la saisie** : le champ Code met en majuscules et retire les caractères interdits dans son `onChange`. L'utilisateur ne peut donc pas saisir une valeur invalide.
- **`Controller`** relie à React Hook Form un champ qui n'est pas un `<input>` natif (le sélecteur de responsable, la liste des départements).
- **Retranscrire la sémantique de l'API** : dans le formulaire, « pas de responsable » vaut `null`. À l'envoi, la création transmet `undefined` (« rien à définir ») et la modification `null` (« retirer le responsable »). C'est le motif absent / `null` / valeur du DTO, vu du côté React.
- **Les erreurs serveur** : `applyFieldErrors` place les erreurs de validation sous leur champ, un 409 devient une erreur sur le champ Code, et les autres cas une alerte en haut du formulaire. Au-delà de trois champs, `FormErrorSummary` liste les erreurs avec un lien vers chacune.

## 7. Un sélecteur avec recherche côté serveur

Choisir un responsable parmi des milliers de comptes ne passe pas par une liste déroulante. `user-picker.tsx` assemble deux primitives shadcn, `Popover` et `Command` (c'est la recette « combobox » de shadcn) :

```tsx
<Command shouldFilter={false}>
  <CommandInput value={search} onValueChange={setSearch} />
  ...
</Command>
```

- `shouldFilter={false}` : la liste a déjà été filtrée par l'API (`useUsers({ search, status: "ACTIVE", page_size: 10 })`), `Command` ne doit pas filtrer une seconde fois.
- La recherche est différée de 250 ms, comme dans les listes.
- Pour les départements, peu nombreux, un simple `Select` suffit (`department-select.tsx`). Le commentaire `shortcut:` dit à partir de quand changer d'approche. Choisir le composant selon le volume de données est une décision qui revient sans cesse.

## 8. Ajouter un champ à un formulaire existant

Le département de chaque compte est arrivé par **un seul** endroit : `profileSchema` et `UserProfileFields`, partagés par le dialogue de création et l'onglet Profil. Les deux formulaires l'ont reçu sans être modifiés, à part la valeur initiale et l'envoi. Factoriser les champs d'une entité est plus durable que factoriser des écrans.

## 9. Les traductions

Chaque domaine a son fichier (`src/locales/fr/departments.json`), reproduit en anglais. Deux mécanismes à connaître :

- **Les pluriels** : `members_one` et `members_other`, appelés avec `t("departments.members", { count })`. i18next choisit la forme selon la langue ; en français, 0 et 1 prennent `_one`.
- **Les clés dynamiques** (`t(\`activity.actions.${action}\`)`) ne sont pas détectées par `scripts/i18n-check.mjs`. Le commentaire au-dessus de l'appel liste les valeurs possibles, et il faut les ajouter à la main dans les fichiers.

## 10. Tester

- **Parcours de bout en bout** (`tests/e2e/departments.spec.ts`) : créer un département avec un responsable trouvé par la recherche, créer un compte dans ce département, vérifier que la suppression est bloquée, suivre le lien vers les membres. Le test cible les éléments par leur rôle et leur nom accessible (`getByRole("combobox", { name: /responsable/i })`), comme le ferait un lecteur d'écran : un test qui passe est aussi un indice d'accessibilité.
- **Accessibilité** : `/departments` a rejoint `tests/a11y/screens.spec.ts`.
- **Les cinq preuves UI** : audit Tailwind, responsive, axe, traductions, types et build (voir `docs/architecture/ui.md`).

Si le port 3000 est déjà pris sur votre machine :

```bash
cd backend && PORT=3100 npm run start:dev
```

```bash
cd frontend && API_PROXY_TARGET=http://localhost:3100 npm run dev
```

`API_PROXY_TARGET` est lu par Vite, côté Node. Il n'est jamais envoyé au navigateur, contrairement aux variables `VITE_*`, qui sont publiques par construction.

## Exercices

1. **Facile.** Affichez le département (code et nom) dans l'en-tête de la fiche d'un compte, sous l'adresse e-mail. Le type `User` le contient déjà.
2. **Moyen.** Rendez la colonne Département de la liste des comptes triable. Il faut une valeur `department` dans `USER_SORT_FIELDS` côté API (tri sur `department.code`), un test e2e, puis `openapi:export`, `api:generate` et `SortableHead` côté écran.
3. **Plus difficile.** Si vous avez fait l'exercice 3 du chapitre 02 (`GET /departments/:id/members`), ajoutez une page de détail `/departments/:id` avec la liste paginée de ses membres, sur le modèle de `role-detail-page.tsx`.

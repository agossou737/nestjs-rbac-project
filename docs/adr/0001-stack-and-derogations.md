# ADR 0001 : stack imposée et dérogations aux règles ASIN

- Statut : acceptée
- Date : 2026-11-04

## Contexte

Le cahier des charges d'Access Manager impose une stack qui diverge de la stack de référence ASIN et de plusieurs règles du harness (BE-2, BE-4, FE-1, thème ASIN).

## Décisions (accordées explicitement par l'utilisateur)

| Règle ASIN | Choix du projet |
|---|---|
| PostgreSQL | MySQL 8 + Prisma Migrate (migrations versionnées, jamais modifiées une fois appliquées) |
| Keycloak | Authentification locale : Passport + JWT (access 15 min, en mémoire côté navigateur) et refresh token opaque haché en base, en cookie HttpOnly/Secure/SameSite=Strict, avec rotation et détection de rejeu |
| FE-1 openapi-fetch | Axios, avec des types générés depuis le document Swagger du backend ; code réseau limité à `src/api/` |
| BE-4 zod | class-validator / class-transformer (ValidationPipe global, whitelist) |
| BE-2 pagination par curseur | `{ items, total, page, page_size }` ; snake_case et ISO 8601 conservés |
| Thème #4471C4 | Primaire #2563EB, police Inter auto-hébergée |
| Tests en phase 9 | Refusé : TDD dans chaque phase, la phase 9 complète la couverture |

## Conséquences

- Les règles ASIN non citées ici restent applicables : problem+json (BE-3), couches (BE-5), logs JSON sans PII (BE-7), configuration par variables d'environnement (BE-9), aucun secret dans `VITE_*` (FE-5).
- Un passage en production ASIN demanderait de réévaluer PostgreSQL et Keycloak.

# Access Manager

Project CLAUDE.md. The asin-harness rules are the floor; this file may add or tighten. The derogations below were granted explicitly by the user in chat on 2026-11-04 (see `docs/adr/0001-stack-and-derogations.md`).

## Stack
- Monorepo: `frontend/` (React + TypeScript + Vite) and `backend/` (NestJS + TypeScript)
- Database: MySQL 8 with Prisma Migrate (derogation: PostgreSQL)
- Identity: local auth, Passport + JWT access token, rotating refresh token in an HttpOnly cookie (derogation: Keycloak)
- Build command: `npm run build` in each package
- Test command: `npm test` and `npm run test:e2e` in `backend/`
- registry: none yet (local docker-compose only)

## Front
- framework: react
- ui-kit: shadcn
- theme: primary #2563EB, background #F8FAFC, text #111827, muted #64748B, border #E2E8F0, font Inter self-hosted (derogation: ASIN theme #4471C4)
- locales: fr
- api-client: axios with types generated from the backend Swagger document (derogation: openapi-fetch); network code under `src/api/` only, access token in memory only
- dev-port: 5180 (strictPort)

## API conventions
- Base path `/api/v1`, JSON fields in snake_case, dates ISO 8601 UTC.
- Lists: `{ items, total, page, page_size }` (derogation to BE-2 cursor pagination, pagination only).
- Errors: `application/problem+json` (BE-3) from one global filter.
- Validation: class-validator DTOs with a global ValidationPipe, whitelist and forbidNonWhitelisted (derogation: zod).

## Method
- 10 phases in order (analysis, design system, database, auth, RBAC, business modules, React UI, logs/security/errors, tests, docs/Docker).
- TDD inside each phase: Supertest e2e tests written with each backend module; phase 9 completes coverage.

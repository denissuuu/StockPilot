# StockPilot API

API REST TypeScript/Fastify 5 pour la gestion de portfolio, catalogue, stock, achats, ventes et dashboard. PostgreSQL/Prisma et Redis sont requis.

## Démarrage local

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

- Swagger UI : `http://localhost:3000/docs`
- OpenAPI JSON : `http://localhost:3000/openapi.json`
- Liveness : `http://localhost:3000/health/live`
- Readiness : `http://localhost:3000/health/ready`

Le seed crée notamment `admin@stockpilot.local` avec le mot de passe `Admin123!` (à changer en production).

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Isolation et sécurité

Toutes les ressources métier sont filtrées par l’organisation (companyId) issue du JWT. Les refresh tokens sont des JWT rotatifs, stockés dans Redis et envoyés dans un cookie HttpOnly. Les mouvements de stock sont créés uniquement par les transactions métier, n’ont pas de route de modification et sont protégés par un trigger PostgreSQL.

## Docker

```bash
JWT_ACCESS_SECRET='un-secret-access-de-32-caracteres-minimum' \
JWT_REFRESH_SECRET='un-secret-refresh-de-32-caracteres-minimum' \
docker compose up --build
```

En production, définir des secrets JWT distincts, `COOKIE_SECURE=true`, `CORS_ORIGIN` et les variables de connexion. Le service refuse les secrets de développement en mode production.

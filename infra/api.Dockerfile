# syntax=docker/dockerfile:1

# Étape de construction : les dépendances des deux workspaces sont installées
# à la racine afin de conserver les dépendances hoistées de npm.
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true

COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run db:generate
RUN npm run build:api

# Étape runtime : l'API et ses dépendances Prisma sont conservées afin que
# `migrate deploy` puisse être exécuté par l'entréepoint.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY infra/api-entrypoint.sh ./infra/api-entrypoint.sh
RUN chmod +x /app/infra/api-entrypoint.sh \
    && chown -R node:node /app

USER node
EXPOSE 3000
ENTRYPOINT ["/app/infra/api-entrypoint.sh"]

# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true

# L'URL est figée au moment du build Vite. La valeur par défaut est relative
# afin que le navigateur passe par le proxy Nginx de Compose.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:web

FROM nginx:1.27-alpine AS runtime

COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[stockpilot] Application des migrations PostgreSQL..."
  npm run db:deploy
fi

echo "[stockpilot] Démarrage de l'API..."
exec npm run start:api

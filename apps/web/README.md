# StockPilot Web

Interface React + TypeScript + Vite du module web de StockPilot.

## Démarrage

```bash
npm install
npm run dev
```

Copiez les variables nécessaires dans un fichier `.env.local` :

```bash
VITE_API_URL=http://localhost:3000/api/v1
```

L'interface utilise un cookie `HttpOnly` pour le refresh token. Les requêtes sont automatiquement retentées après un `401` lorsqu'un refresh est possible.

## Vérifications

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

L'application ne dépend pas d'un mock local : les pages consomment les ressources de l'API `/api/v1` et affichent les états de chargement, erreur et données vides.

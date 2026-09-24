# API REST StockPilot

Ce document décrit le contrat HTTP public de l'API `@stockpilot/api`. Il est volontairement indépendant du client web : une intégration externe doit utiliser les mêmes enveloppes, codes d'erreur et règles d'authentification.

> La source de vérité technique est le schéma OpenAPI exposé par l'API et les schémas Zod de `apps/api`. Les exemples ci-dessous sont des exemples d'utilisation et ne constituent pas une preuve d'exécution.

## 1. Accès

| Contexte | URL de base | Remarque |
| --- | --- | --- |
| Développement local | `http://localhost:3000/api/v1` | API Fastify sur le port 3000 |
| Docker Compose | `http://localhost:8080/api/v1` | Nginx sert le web et proxifie l'API |
| Sonde de santé | `http://localhost:3000/health` | Route non authentifiée; les sondes détaillées sont `/health/live` et `/health/ready`. |

Les chemins et méthodes ci-dessous sont relatifs à l'URL de base. Les ressources sensibles à un tenant ne sont accessibles qu'après authentification.

Les sondes sont publiques :

- `GET /health` et `GET /health/live` vérifient que le processus répond ;
- `GET /health/ready` vérifie également PostgreSQL et Redis et renvoie `503` si l'une des dépendances est indisponible.

## 2. Conventions

### En-têtes

```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer <access-token>
```

Le refresh token peut être fourni dans le corps de `POST /auth/refresh` pour un client non navigateur. Le client web doit conserver le cookie `HttpOnly` et envoyer les requêtes avec `credentials: include`.

### Réponse succès

Les routes qui renvoient une ressource utilisent cette enveloppe :

```json
{
  "success": true,
  "data": {
    "id": "6c3b5c4e-2e8c-4dc5-9f6b-7cb4b2a1d111",
    "name": "Clavier ergonomique"
  }
}
```

Les listes paginées ajoutent `meta` :

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Une suppression réussie peut répondre par `204 No Content` sans corps.

### Réponse d'erreur

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données envoyées sont invalides",
    "details": {
      "fieldErrors": {
        "email": ["String must contain a valid email"]
      }
    },
    "requestId": "req_01HX..."
  }
}
```

Le client doit utiliser `error.code` pour le traitement programmatique et `error.message` pour l'affichage. Les détails sont facultatifs et ne doivent pas exposer de stack trace.

### Dates, nombres et identifiants

- Les identifiants sont des UUID.
- Les dates sont des chaînes ISO 8601; l'API calcule et sérialise les périodes en UTC.
- Les montants et quantités sont des nombres JSON issus de valeurs `Decimal` côté persistance. Le format de devise est porté par l'organisation.
- Les champs non applicables sont omis ou renvoyés à `null` selon le sérialiseur du module.

## 3. Authentification

### 3.1 Créer une organisation

`POST /auth/register` est public et limité par limitation de débit. Il crée l'organisation et son premier administrateur dans une transaction.

```bash
curl -i http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationName": "Atelier Nord",
    "firstName": "Marie",
    "lastName": "Martin",
    "email": "marie@atelier-nord.example",
    "password": "MotDePasse1",
    "currency": "EUR",
    "timezone": "Europe/Paris"
  }'
```

Réponse `201` (forme simplifiée) :

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "…",
      "email": "marie@atelier-nord.example",
      "role": "ADMIN",
      "organization": {
        "id": "…",
        "name": "Atelier Nord",
        "currency": "EUR",
        "timezone": "Europe/Paris"
      }
    },
    "accessToken": "eyJ…",
    "refreshToken": "eyJ…",
    "expiresIn": "15m"
  }
}
```

### 3.2 Se connecter

```bash
curl -i -c cookies.txt http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"marie@atelier-nord.example","password":"MotDePasse1"}'
```

La réponse contient également un cookie `stockpilot_refresh` pour le navigateur. Conservez `cookies.txt` dans un environnement de test pour les appels suivants.

### 3.3 Rafraîchir la session

Le client web appelle la route sans corps et transmet le cookie :

```bash
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3000/api/v1/auth/refresh
```

Un client non navigateur peut envoyer `{ "refreshToken": "…" }`. La rotation invalide l'ancien refresh token. Un refresh token absent, expiré, révoqué ou déjà utilisé reçoit `401`.

### 3.4 Se déconnecter et lire son profil

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/v1/auth/logout
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

`POST /auth/logout` est idempotent. `GET /auth/me` permet de revalider une session au chargement de l'application.

## 4. Ressources et autorisation

Les rôles sont `ADMIN`, `MANAGER`, `EMPLOYEE` et `VIEWER`. Les droits exacts sont vérifiés côté API ; masquer un bouton dans le web ne constitue pas une autorisation.

| Ressource | Lecture | Écriture / action |
| --- | --- | --- |
| Organisation | tous les rôles | `ADMIN`, `MANAGER` |
| Utilisateurs | tous les rôles | `ADMIN`, `MANAGER` selon l'opération |
| Catalogue | tous les rôles | `ADMIN`, `MANAGER` |
| Stock et ajustements | tous les rôles en lecture | `ADMIN`, `MANAGER`, `EMPLOYEE` pour les ajustements |
| Achats | tous les rôles en lecture | `ADMIN`, `MANAGER` |
| Ventes | tous les rôles en lecture | `ADMIN`, `MANAGER`, `EMPLOYEE` |
| Exports | tous les rôles | selon le module exporté |

### Organisation, utilisateurs et partenaires

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/organizations` | Organisation courante |
| `PATCH` | `/organizations` | Mise à jour de l'organisation (`ADMIN`/`MANAGER`) |
| `GET` | `/users` | Liste paginée des utilisateurs |
| `POST` | `/users` | Crée un utilisateur |
| `GET` | `/users/{id}` | Détail d'un utilisateur |
| `PATCH` | `/users/{id}` | Modification et rôle |
| `DELETE` | `/users/{id}` | Désactivation d'un utilisateur |
| `GET` | `/suppliers` | Liste des fournisseurs |
| `POST` | `/suppliers` | Crée un fournisseur |
| `GET` | `/suppliers/{id}` | Détail d'un fournisseur |
| `PATCH` | `/suppliers/{id}` | Modification d'un fournisseur |
| `DELETE` | `/suppliers/{id}` | Désactivation d'un fournisseur |
| `GET` | `/customers` | Liste des clients |
| `POST` | `/customers` | Crée un client |
| `GET` | `/customers/{id}` | Détail d'un client |
| `PATCH` | `/customers/{id}` | Modification d'un client |
| `DELETE` | `/customers/{id}` | Désactivation d'un client |

Les suppressions de ces ressources sont logiques lorsque l'historique doit être conservé. Les filtres `search`, `page` et `pageSize` sont disponibles sur les listes.

## 5. Catalogue

### Produits

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/products` | Liste paginée et stock courant |
| `GET` | `/products/alerts` | Produits dont le stock est inférieur ou égal au seuil |
| `POST` | `/products` | Crée un produit (`ADMIN`/`MANAGER`) |
| `GET` | `/products/{id}` | Détail d'un produit |
| `GET` | `/products/{id}/stock` | Stock et derniers mouvements |
| `PATCH` | `/products/{id}` | Modifie un produit |
| `DELETE` | `/products/{id}` | Désactive un produit |

Paramètres de liste fréquents : `page`, `pageSize` (1 à 100), `search`, `categoryId`, `lowStock`.

```bash
curl 'http://localhost:3000/api/v1/products?page=1&pageSize=20&lowStock=true' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Création :

```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "sku": "CLA-001",
    "name": "Clavier ergonomique",
    "barcode": "376000000001",
    "costPrice": 42.50,
    "salePrice": 79.90,
    "taxRate": 20,
    "minStock": 5,
    "maxStock": 80
  }'
```

### Catégories

`GET`, `POST`, `GET /categories/{id}`, `PATCH /categories/{id}` et `DELETE /categories/{id}` sont disponibles. Une catégorie peut avoir un parent via `parentId`. La suppression est refusée si des produits ou sous-catégories y sont encore rattachés.

## 6. Stock

Le module stock est monté sous le préfixe `/api/v1` dans le bootstrap de l'API. Les routes publiques sont donc `/api/v1/movements` et `/api/v1/adjustments` (et non un second préfixe `/stock`). Toute évolution de ce montage doit être reflétée dans OpenAPI et dans le client web.

### Mouvements

```bash
curl 'http://localhost:3000/api/v1/movements?page=1&pageSize=50&type=SALE' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Filtres : `productId`, `type`, `from`, `to`, `search`. Les mouvements sont un journal métier : ils ne sont pas modifiés ni supprimés individuellement.

### Ajustement

```bash
curl -X POST http://localhost:3000/api/v1/adjustments \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "6c3b5c4e-2e8c-4dc5-9f6b-7cb4b2a1d111",
    "quantity": -2,
    "reason": "COUNT_CORRECTION",
    "note": "Écart constaté lors de l’inventaire annuel"
  }'
```

`quantity` est signée et ne peut pas être zéro. Une valeur négative retire du stock. L'API crée le mouvement et sa trace d'audit dans une même transaction.

## 7. Achats et ventes

### Commandes d'achat

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/purchase-orders` | Liste paginée |
| `POST` | `/purchase-orders` | Crée un brouillon |
| `GET` | `/purchase-orders/{id}` | Détail et lignes |
| `PATCH` | `/purchase-orders/{id}` | Modifie un brouillon |
| `POST` | `/purchase-orders/{id}/order` | Marque la commande transmise |
| `POST` | `/purchase-orders/{id}/receive` | Réceptionne et crédite le stock |
| `POST` | `/purchase-orders/{id}/cancel` | Annule une commande non reçue |

Exemple de création :

```bash
curl -X POST http://localhost:3000/api/v1/purchase-orders \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "supplierId": "…",
    "reference": "CMD-2026-001",
    "expectedAt": "2026-10-15T00:00:00.000Z",
    "lines": [
      {"productId":"…","quantity":20,"unitCost":39.90,"taxRate":20}
    ]
  }'
```

Réception :

```bash
curl -X POST http://localhost:3000/api/v1/purchase-orders/<id>/receive \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"lines":[{"lineId":"…","quantity":20}]}'
```

La réception est idempotente uniquement si le contrat de l'opération le précise ; ne pas rejouer automatiquement une réception en cas de timeout sans vérifier l'état de la commande.

### Ventes

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/sales` | Liste paginée |
| `POST` | `/sales` | Crée une vente et sort le stock |
| `GET` | `/sales/{id}` | Détail d'une vente |
| `POST` | `/sales/{id}/cancel` | Annule et réintègre le stock |

```bash
curl -X POST http://localhost:3000/api/v1/sales \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId": "…",
    "reference": "VTE-2026-001",
    "lines": [
      {"productId":"…","quantity":2,"unitPrice":79.90,"taxRate":20}
    ]
  }'
```

Le serveur recalcule le coût de revient, la marge et les mouvements. Le client ne doit pas envoyer un stock ou une marge de confiance comme source de vérité.

## 8. Tableau de bord et exports

### Tableau de bord

`GET /dashboard` accepte `from`, `to` et `granularity` (`day`, `week`, `month`). La réponse contient la période, les KPI, une série temporelle et les produits les plus vendus. La période est bornée par l'API pour éviter une requête coûteuse ou non bornée.

```bash
curl 'http://localhost:3000/api/v1/dashboard?granularity=month' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### CSV

`GET /exports?type=products|sales|stock-movements` renvoie un fichier `text/csv` avec un en-tête `Content-Disposition`. Les exports sont filtrés par organisation et par rôle ; ils ne doivent pas être utilisés comme mécanisme de sauvegarde à eux seuls.

```bash
curl -L 'http://localhost:3000/api/v1/exports?type=products' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o products.csv
```

## 9. Codes HTTP et erreurs courantes

| Code | Signification |
| --- | --- |
| `200` | Lecture ou mise à jour réussie |
| `201` | Ressource créée |
| `204` | Suppression/désactivation réussie |
| `400` | Requête invalide |
| `401` | Token absent, expiré ou invalide |
| `403` | Rôle insuffisant |
| `404` | Ressource absente pour l'organisation |
| `409` | Conflit d'unicité ou concurrence de mise à jour |
| `422` | Règle métier impossible à satisfaire |
| `429` | Limitation de débit dépassée |
| `500` | Erreur interne ; consulter `requestId` dans les logs |

Les erreurs de validation `Zod` sont converties en `VALIDATION_ERROR`. Les conflits d'unicité Prisma sont convertis en `CONFLICT` sans exposer les détails SQL.

## 10. Pagination, filtres et idempotence

- `page` commence à 1.
- `pageSize` est compris entre 1 et 100, avec 20 par défaut.
- Les réponses paginées exposent `total` et `totalPages`.
- Les filtres de dates doivent être des dates ISO; l'API vérifie `from <= to`.
- Les mutations de stock, de réception et de vente sont transactionnelles. En cas de réponse réseau ambiguë, lire l'état de la ressource avant de retenter.
- Les suppressions de produits, fournisseurs, clients et utilisateurs sont des désactivations logiques dans le modèle actuel.

## 11. Versionnement et évolution

Le préfixe `/api/v1` permet de préserver le contrat lors des évolutions incompatibles. Une modification de champ ou de sémantique doit être documentée dans OpenAPI et être accompagnée d'une stratégie de migration pour les clients existants. La documentation humaine reste la référence ; l'implémentation doit également exposer un schéma OpenAPI à jour.

## 12. Sécurité pour les intégrateurs

- Ne loguez jamais `Authorization`, les cookies ou le corps de login.
- Utilisez HTTPS en dehors du développement local.
- Conservez les refresh tokens dans un stockage protégé; évitez `localStorage` pour une application web exposant des données de gestion.
- Respectez les `Retry-After` sur `429` et ne bouclez pas les erreurs `401` sans déclencher la rotation une seule fois.
- Limitez les droits d'un token à l'organisation et au rôle délivrés par l'API.
- Vérifiez les `requestId` dans les journaux du serveur lorsqu'un incident doit être correlé.

# Décisions d'architecture

Les décisions ci-dessous décrivent les choix structurants du monorepo. Une nouvelle décision importante doit être ajoutée ici avec son contexte, ses alternatives et sa conséquence.

## ADR-001 — npm workspaces pour le monorepo

**Statut :** retenu

Le dépôt utilise un `package.json` racine avec `workspaces: ["apps/*"]`. Les dépendances communes sont installées une seule fois et les scripts racine peuvent cibler les deux applications.

**Pourquoi :** le projet est un monorepo TypeScript de petite taille ; npm est disponible avec Node.js et évite d'imposer un second gestionnaire de paquets. Les lockfiles des autres gestionateurs sont ignorés pour éviter les installations ambiguës.

**Conséquence :** les manifests de chaque workspace restent la source de vérité de leurs scripts. Un unique `package-lock.json` racine est versionné ; Docker et la CI utilisent `npm ci` pour une installation reproductible.

## ADR-002 — Fastify, Prisma, PostgreSQL et Redis

**Statut :** retenu

L'API est une application TypeScript Fastify. Prisma fournit le client typé et les migrations vers PostgreSQL 16. Redis conserve les refresh tokens afin de permettre rotation et révocation.

**Pourquoi :** cette combinaison couvre un REST API versionné, une validation explicite, des requêtes transactionnelles et une persistance relationnelle adaptée au modèle catalogue/stock. Redis n'est pas utilisé comme base métier.

**Conséquence :** les migrations, l'indexation et la connectivité doivent être testées dans la CI. La rotation des sessions dépend de Redis ; une indisponibilité de Redis doit être traitée explicitement par l'observabilité.

## ADR-003 — JWT court + refresh cookie HttpOnly

**Statut :** retenu

L'access token JWT est envoyé dans l'en-tête `Authorization: Bearer`. Le refresh token est stocké dans un cookie `HttpOnly`, `SameSite=Lax`, avec chemin `/api/v1/auth`, et sa présence est validée dans Redis.

**Pourquoi :** le navigateur n'a pas besoin de lire le refresh token, ce qui réduit l'exposition à XSS. La rotation permet de révoquer une session et de limiter la durée d'un jeton d'accès.

**Conséquence :** les clients non navigateur doivent stocker les jetons avec la même discipline de confidentialité. En production, `COOKIE_SECURE=true` et HTTPS sont obligatoires.

## ADR-004 — Compose pour le développement et Nginx pour le bundle web

**Statut :** retenu

`docker-compose.yml` fournit PostgreSQL 16, Redis 7, l'API et un serveur web Nginx. Les images sont multi-stage et utilisent le contexte racine pour partager les workspaces npm.

**Pourquoi :** une seule commande reproduit les dépendances de runtime sans installer PostgreSQL et Redis sur la machine. Nginx sert les assets Vite et proxifie `/api/`, ce qui simplifie le same-origin en recette.

**Conséquence :** les migrations sont exécutées au démarrage de l'API par défaut. Les opérateurs peuvent désactiver ce comportement avec `RUN_MIGRATIONS=false` et lancer une tâche de migration séparée.

## ADR-005 — Les montants et quantités restent des décimaux

**Statut :** retenu

La base utilise `Decimal` pour les prix, taxes, totaux, marges et quantités. La sérialisation HTTP convertit les valeurs en nombre JSON pour le client, mais les calculs métier ne reposent pas sur des flottants JavaScript.

**Pourquoi :** les erreurs d'arrondi sur les montants ont des conséquences opérationnelles et financières. La stratégie permet de migrer plus tard vers une stratégie de devise plus stricte.

**Conséquence :** les calculs de taxes et de marge doivent être testés avec des cas de centimes et des quantités décimales.

## Questions ouvertes

- Le mode SaaS multi-organisation est déjà présent dans le modèle ; il faudra décider du niveau d'isolation (base dédiée ou schémas) avant une forte croissance.
- La source des exports CSV et la fréquence de génération des KPI doivent être documentées avec les besoins de reporting.
- Le stockage des pièces jointes, la fiscalité par pays et la synchronisation ERP ne sont pas encore définis.
- Les objectifs de disponibilité, RPO/RTO et le fournisseur de secrets de production restent à confirmer.

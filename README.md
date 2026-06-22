# JDMDEX Backend

## Description du projet

JDMDEX (Japanese Domestic Market Dex) est une application de référencement de voitures japonaises croisées lors d'événements et de rassemblements. L'idée est de constituer un historique des JDM rencontrées : chaque voiture est documentée avec des champs détaillés (moteur, puissance, kilométrage, localisation…) qui permettent d'engager un dialogue plus approfondi avec les propriétaires et d'enrichir ses connaissances mécaniques au fil des rencontres. Le projet se compose d'un backend API REST et d'un frontend séparé qui communiquent via HTTP.

## Le backend — rôle de l'API

L'API gère tout ce qui touche à la donnée et à la sécurité :
- **Authentification** : inscription, connexion, émission et vérification de tokens JWT
- **Gestion des voitures** : CRUD complet, isolation par utilisateur (chaque user ne voit que ses propres voitures)
- **Upload de photos** : stockage via Bunny CDN, organisation par utilisateur et par voiture
- **Événements et utilisateurs** : routes supplémentaires pour les événements liés aux voitures

Le frontend ne fait qu'appeler ces routes — aucune logique métier ne lui est déléguée.

## Analyse du projet

> Y a-t-il des tests ? Faut-il en écrire ?

**Oui, des tests existent.** Le dossier `src/tests/` contient des tests unitaires (génération de tokens JWT, middleware d'authentification) et des tests fonctionnels (vérification des droits d'accès par propriétaire). Ils sont exécutés avec Jest et la couverture est générée à chaque CI.

Ce qui manque encore et mériterait d'être ajouté :
- Tests d'intégration sur les routes CRUD (cars, events, users) avec une base de test dédiée
- Tests de la route d'upload photo (mock Bunny CDN)
- Un seuil de couverture minimum dans la CI (ex : 80%) pour bloquer un merge si la couverture régresse

> Y a-t-il un build à produire ?

**Oui : une image Docker.** Le `Dockerfile` utilise un build multi-stage pour produire une image de production allégée (sans les dépendances de développement). Cette image est construite automatiquement par la CI sur les branches `main` et `develop`, puis déployée sur le VPS via `docker-compose`.

Il n'y a pas de bundle JavaScript à produire côté backend — Node.js exécute les fichiers source directement.

> Où est-ce que le projet est censé tourner ?

**Sur un VPS**, via Docker Compose. L'architecture est simple :
- Un conteneur Node.js pour l'API
- Un conteneur MariaDB pour la base de données

Le déploiement est déclenché automatiquement par GitHub Actions sur push vers `develop`, via SSH. Il n'y a pas de Kubernetes, pas de cloud provider, pas de serverless — un seul serveur, un seul `docker-compose up -d`.

> Quels sont les risques si on déploie du code cassé en production ?

Les risques concrets pour ce projet :

| Risque | Impact |
|--------|--------|
| Route d'auth cassée | Plus personne ne peut se connecter — l'application est inutilisable |
| Mauvais filtre `user_id` | Un utilisateur peut voir ou modifier les voitures d'un autre |
| Erreur de migration DB | Perte ou corruption de données, redémarrage impossible |
| Upload Bunny CDN cassé | Les photos ne sont plus enregistrées, mais l'UI ne le signale pas forcément |
| Fuite de JWT_SECRET | Tous les tokens existants peuvent être forgés — compromission totale |

La CI (lint + tests + build) est la première ligne de défense. Sans elle, un push cassé part directement en prod.

> Quels outils du cours sont réellement utiles pour CE projet ?

| Outil | Utile ? | Pourquoi |
|-------|---------|----------|
| **GitHub Actions** | ✅ Oui | Pipeline complet déjà en place — lint, tests sur Node 22/24, build Docker, déploiement SSH sur `develop` |
| **Docker / Docker Compose** | ✅ Oui | L'API et la DB tournent en conteneurs, c'est la base du déploiement |
| **Jest + coverage** | ✅ Oui | Tests unitaires et fonctionnels déjà écrits, rapport de couverture généré en CI |
| **ESLint** | ✅ Oui | Qualité de code vérifiée à chaque push, bloque les erreurs de style avant review |
| **SSH deploy** | ✅ Oui | Le déploiement VPS est fait via `appleboy/ssh-action`, simple et efficace pour ce contexte |
| **Kubernetes** | ❌ Pas maintenant | Overkill pour une API mono-instance sur un VPS — ajouter si on passe à un cluster |
| **Terraform** | ❌ Pas maintenant | Pas d'infra cloud complexe à provisionner |
| **SonarQube** | ❌ Pas maintenant | Surdimensionné pour ce volume de code, à envisager si le projet grandit |
| **Snyk / Trivy** | ⚠️ À envisager | Utile avant une mise en prod réelle pour scanner les vulnérabilités des dépendances et de l'image Docker |

## Prérequis

- Node.js 18+
- Docker et Docker Compose
- MariaDB 10.11+

## Configuration

### 1. Cloner le dépôt et installer les dépendances

```bash
git clone https://github.com/Koruji/JDMDEX-back.git
cd JDMDEX-back
npm install
```

### 2. Configurer l'environnement

Copier le fichier `.env.example` en `.env` et modifier les valeurs selon votre configuration :

```bash
cp .env.example .env
```

Éditer le fichier `.env` avec vos informations de connexion MariaDB et votre clé secrète JWT.

### 3. Démarrer les services avec Docker

```bash
# Démarrer MariaDB et l'application
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down
```

### 4. Utilisation sans Docker (développement)

Si vous préférez utiliser une instance MariaDB locale :

1. Installer MariaDB sur votre machine
2. Créer la base de données et l'utilisateur :
   ```sql
   CREATE DATABASE jdmdex;
   CREATE USER 'jdmdex_user'@'localhost' IDENTIFIED BY 'jdmdex_pass';
   GRANT ALL PRIVILEGES ON jdmdex.* TO 'jdmdex_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
3. Configurer le `.env` avec `MYSQL_HOST=localhost`
4. Démarrer l'application :
   ```bash
   npm run dev
   ```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| PORT | Port de l'application | 3000 |
| NODE_ENV | Environnement (development, production) | development |
| MYSQL_HOST | Hôte MariaDB | localhost |
| MYSQL_PORT | Port MariaDB | 3306 |
| MYSQL_DATABASE | Nom de la base de données | jdmdex |
| MYSQL_USER | Utilisateur MariaDB | jdmdex_user |
| MYSQL_PASSWORD | Mot de passe MariaDB | jdmdex_pass |
| MYSQL_ROOT_PASSWORD | Mot de passe root MariaDB | rootpassword |
| JWT_SECRET | Clé secrète pour JWT | supersecretjdmdexkey12345 |
| JWT_EXPIRES_IN | Durée de validité du token | 24h |

## Développement

Pour le développement, vous pouvez utiliser nodemon :

```bash
npm run dev
```

Les tests peuvent être lancés avec :

```bash
npm test
```

## API Endpoints

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription d'un nouvel utilisateur |
| POST | `/api/auth/login` | Connexion d'un utilisateur existant |
| GET | `/api/auth/me` | Récupérer les informations de l'utilisateur connecté |

**Exemple de requête d'inscription :**
```json
POST /api/auth/register
Content-Type: application/json

{
  "username": "monutilisateur",
  "email": "user@example.com",
  "password": "motdepasse123"
}
```

**Exemple de réponse :**
```json
{
  "user": {
    "id": 1,
    "username": "monutilisateur",
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Exemple de requête de connexion :**
```json
POST /api/auth/login
Content-Type: application/json

{
  "username": "monutilisateur",
  "password": "motdepasse123"
}
```

### Voitures

Toutes les routes de voitures nécessitent un token JWT valide dans le header `Authorization` :
```
Authorization: Bearer <token>
```

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/cars` | Liste toutes les voitures de l'utilisateur connecté |
| GET | `/api/cars/:id` | Récupérer une voiture spécifique |
| POST | `/api/cars` | Créer une nouvelle voiture |
| PUT | `/api/cars/:id` | Mettre à jour une voiture |
| DELETE | `/api/cars/:id` | Supprimer une voiture |
| POST | `/api/cars/:id/photos` | Ajouter des photos à une voiture |
| DELETE | `/api/cars/:id/photos/:photoId` | Supprimer une photo |
| POST | `/api/cars/recognize` | Reconnaissance AI (mock) |

**Exemple de création de voiture :**
```json
POST /api/cars
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "name": "Nissan Skyline GT-R",
  "brand": "Nissan",
  "year": 1999,
  "horsepower": 280,
  "engine": "RB26DETT 2.6L Twin-Turbo"
}
```

## Structure de la base de données

### Tables

- **users** : Utilisateurs du système
  - id, username, email, password_hash, created_at, updated_at

- **cars** : Voitures JDM
  - id, name, brand, year, horsepower, engine, mileage, owner, location, latitude, longitude, user_id, created_at, updated_at

- **photos** : Photos des voitures
  - id, car_id, filename, is_primary, created_at

## Sécurité

- Tous les mots de passe sont hachés avec bcrypt
- Les tokens JWT sont signés avec une clé secrète configurable
- Chaque utilisateur ne peut accéder qu'à ses propres voitures et photos
- Les requêtes aux routes protégées nécessitent un token valide

## Migration depuis SQLite

Si vous aviez déjà des données dans SQLite et souhaitez les migrer vers MariaDB :

1. Exportez vos données depuis SQLite :
   ```bash
   sqlite3 jdmdex.db ".dump" > sqlite_dump.sql
   ```

2. Modifiez le script SQL pour qu'il soit compatible avec MariaDB

3. Importez dans MariaDB :
   ```bash
   mysql -u root -p jdmdex < sqlite_dump.sql
   ```

Note : La structure des tables a changé (ajout de user_id dans cars, nouvelles tables users). Une migration automatique n'est pas fournie, vous devrez adapter manuellement.

## Architecture pipeline CI/CD

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           FLUX CI/CD (branches develop/main)                      │
├──────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Git Push/      │───▶│   Lint          │───▶│   Test +        │───▶│   Build Docker   │───▶
│   Pull Request   │    │   (ESLint)      │    │   Coverage      │    │   (multi-stage)  │    
└──────────────────┘    └─────────────────┘    └─────────────────┘    └──────────────────┘
                                                                                       │
                                                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           DÉPLOIEMENT VPS                                               │
├───────────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub Actions  │───▶│   SSH Connect   │───▶│   docker-compose │───▶│   API en        │
│   (build image)   │    │   (VPS)         │    │   down + up -d   │    │   production    │
└───────────────────┘    └─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Stratégie de branching
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           STRATÉGIE DE BRANCHING                        │
├───────────────────┬─────────────────┬─────────────────┬─────────────────┐
│     Branch        │    Lint         │     Test        │     Deploy      │
├───────────────────┼─────────────────┼─────────────────┼─────────────────┤
│    main           │      ✅         │      ✅         │      ✅         │
│    develop        │      ✅         │      ✅         │      ✅         │
│    fix/*          │      ✅         │      ✅         │      ❌         │
│    feature/*      │      ✅         │      ✅         │      ❌         │
│    ci/*           │      ✅         │      ✅         │      ❌         │
└───────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Pourquoi ces outils ?

| Outil | Justification | Alternatives écartées |
|-------|---------------|-----------------------|
| **GitHub Actions** | Intégration native GitHub, gratuit pour les dépôts publics | GitLab CI, Jenkins (nécessitent un serveur externe) |
| **Node 22 & 24** | Tests sur les deux versions LTS actives | Node 26 (pas encore LTS) |
| **Docker multi-stage** | Image de prod allégée, sans dépendances dev | Single-stage (embarque trop) |
| **VPS SSH** | Simple, économique, suffisant pour ce prototype | K8s, Serverless (overkill) |
| **Jest** | Bien intégré, déjà en place | Mocha, Vitest |
| **ESLint** | Linting + formatting en un outil | Prettier seul (pas de linting) |

### Outils non retenus

| Outil | Pourquoi pas maintenant | Quand l'ajouter |
|-------|-------------------------|-----------------|
| **SonarQube** | Surdimensionné pour ce volume de code | Si le projet dépasse ~10k lignes |
| **Kubernetes** | Overkill pour une API mono-instance | Si on passe à un cluster multi-services |
| **Terraform** | Pas d'infra cloud complexe | Si on migre vers AWS/GCP/Azure |
| **Snyk / Trivy** | Non critique pour un prototype | Avant une mise en prod réelle |
| **Semantic Release** | Pas de versioning SemVer structuré | Quand le projet sera stable et publié |

### Mesure de couverture

Rapport généré à chaque CI dans `coverage/`, téléchargeable via les artifacts GitHub Actions (rétention 7 jours). **Objectif futur** : ajouter un seuil minimal (ex : 80%) pour bloquer un merge si la couverture régresse.

### Configuration requise

#### Secrets GitHub (`Settings > Secrets > Actions`)

**Applicatifs** :
```
PORT, NODE_ENV, MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE,
MYSQL_USER, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD,
JWT_SECRET, JWT_EXPIRES_IN,
BUNNY_API_KEY, BUNNY_STORAGE_ZONE, BUNNY_PULL_ZONE, LOG_LEVEL
```

**Connexion VPS** :
```
VPS_HOST        # IP ou domaine
VPS_USERNAME    # utilisateur SSH
VPS_SSH_KEY     # clé privée complète (avec les en-têtes)
VPS_PORT        # port SSH (défaut : 22)
```

#### Setup initial sur le VPS

```bash
git clone https://github.com/Koruji/JDMDEX-back.git
cd JDMDEX-back
cp .env.example .env
nano .env
docker-compose up -d
```

Le VPS doit avoir : Node.js 24, Docker, Docker Compose, Git, accès SSH.

### Lancer le pipeline

| Action | Résultat |
|--------|----------|
| Push sur `feature/*`, `fix/*`, `ci/*` | Lint + Test uniquement (pas de déploiement) |
| Push sur `develop` | Lint + Test + Build Docker + Déploiement VPS |
| Pull Request vers `develop` | Lint + Test uniquement |

Pour vérifier l'état du pipeline : onglet **Actions** du dépôt GitHub → cliquer sur le workflow en cours.

### Dépannage

| Problème | Vérification |
|----------|-------------|
| Échec connexion SSH | `VPS_HOST`, `VPS_USERNAME`, `VPS_SSH_KEY` corrects ? Clé dans `~/.ssh/authorized_keys` ? |
| Permission refusée | Droits d'écriture sur le répertoire de déploiement |
| Variable manquante | Logs du workflow → étape "Create .env" |
| Node incompatible | `node -v` sur le VPS → doit être 24 |

**Logs** : onglet **Actions** de GitHub → cliquer sur l'exécution → développer chaque étape.

### Notes de sécurité

- Ne jamais commiter `.env` dans git
- Utiliser les GitHub Secrets pour toutes les valeurs sensibles
- Faire une rotation périodique des clés SSH
- Utiliser des clés de déploiement avec permissions limitées

## Licence

MIT

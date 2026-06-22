# JDMDEX Backend

JDMDex API - Japanese car Pokédex backend avec authentification JWT et base de données MariaDB.

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

## Développement

Pour le développement, vous pouvez utiliser nodemon :

```bash
npm run dev
```

Les tests peuvent être lancés avec :

```bash
npm test
```

## 🏗️ Architecture CI/CD

### Diagramme du Pipeline

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

## 🔍 Analyse CI/CD

### Pourquoi ces outils ont été choisis ?

| **Outil**          | **Justification** | **Alternatives envisagées** | **Pourquoi pas l'alternative ?** |
|--------------------|-------------------|----------------------------|----------------------------------|
| **GitHub Actions** | Intégration native avec GitHub, gratuite pour les dépôts publics, facile à configurer | GitLab CI, Jenkins | On maîtrise GitHub, limites plus élevées, pas besoin de maintenir un serveur CI externe |
| **Node 22 & 24** | Tests sur les deux versions LTS pour garantir la compatibilité | Node 26 | Node 24 pour la prod, tests sur 22 et 24 pour couvrir les versions actives |
| **Docker**         | Standard de conteneurisation, portable, reproductible | LXC, Podman | Docker est le plus répandu, mieux intégré avec CI/CD |
| **Multi-stage Build** | Réduit la taille de l'image finale | Single-stage | Évite d'embarquer les dépendances dev en production |
| **VPS (SSH)**      | Simple, économique, suffisant pour le prototype | Kubernetes, Serverless | Pas besoin de complexité K8s pour 1 API, coût maîtrisé |
| **Jest**           | Framework de test JavaScript populaire, bien intégré | Mocha, Vitest | Déjà utilisé dans le projet, bonne documentation |
| **ESLint**         | Standard de linting JavaScript | Prettier (seul) | ESLint fait du linting ET du formatting, plus complet |

### Outils non retenus (pour l'instant) 🚧

| **Outil**          | **Pourquoi pas maintenant ?** | **Quand l'ajouter ?** |
|--------------------|-------------------------------|------------------------|
| **SonarQube**      | Complexité de setup, surdimensionné pour un petit projet | Quand le projet grandit (10k+ lignes) ou en entreprise |
| **Kubernetes**     | Overkill pour une seule API sur un VPS | Quand on passe à un homelab avec plusieurs services |
| **Terraform**      | Pas d'infrastructure cloud complexe à provisionner | Si on migre vers AWS/GCP/Azure |
| **Snyk/Trivy**     | Scan de vulnérabilités pas critique pour un prototype | Avant la mise en production ou pour un projet professionnel |
| **Quality Gate**   | Nécessite SonarQube ou outil similaire | Quand SonarQube sera configuré |
| **Semantic Release** | Pas encore de versioning SemVer structuré | Quand le projet sera stable et publié |

### Stratégie de Branching

- **`main`** : Branch de production. Les pushes sont protégés (via GitHub). Déploiement automatique.
- **`develop`** : Branch d'intégration. Reçoit les features validées. Déploiement automatique.
- **`feature/*`** : Développement de nouvelles fonctionnalités. Test + Lint seulement, pas de déploiement.
- **`fix/*`** : Corrections de bugs. Test + Lint seulement, pas de déploiement.
- **`ci/*`** : Améliorations de la CI/CD. Test + Lint seulement, pas de déploiement.

### Mesure de Couverture
Actuellement activée avec Jest (`--coverage`). Les rapports sont générés dans le dossier `coverage/` et sont téléchargeables via les artifacts GitHub Actions. **Objectif futur** : Intégrer un seuil minimal (ex: 80%) pour bloquer le merge si la couverture baisse.

## 🚀 GitHub Actions CI/CD

Le pipeline CI/CD (`.github/workflows/ci-cd.yml`) utilise **Node.js 22 et 24** pour les tests et **Node.js 24** pour la production.

### Description du Workflow

#### Stratégie de Branching
| Branche | Lint | Test | Déploiement |
|---------|------|------|-------------|
| `main` | ✅ | ✅ | ✅ |
| `develop` | ✅ | ✅ | ✅ |
| `fix/*`, `feature/*`, `ci/*` | ✅ | ✅ | ❌ |

#### Jobs
1. **Lint** - Exécuté en parallèle sur Node 22 et 24
   - Vérifie la qualité du code avec ESLint
   - Doit réussir pour lancer les tests

2. **Test & Couverture** - Exécuté en parallèle sur Node 22 et 24
   - Exécute les tests avec Jest et génère le rapport de couverture
   - Télécharge le rapport comme artifact (disponible 7 jours)
   - Doit réussir pour lancer le déploiement

3. **Build Docker & Déploiement** - Node 24 uniquement
   - **Seulement sur `main` et `develop`**
   - Requiert que Lint et Test réussissent
   - Crée le fichier `.env` depuis les GitHub Secrets
   - Déploie sur le VPS via SSH avec `appleboy/ssh-action`
   - Exécute `docker-compose down && up -d` pour un déploiement sans interruption
   - Vérifie le déploiement avec `docker-compose ps`

### 📋 Configuration Requise

#### 1. Configurer les Secrets GitHub
Aller dans **Settings > Secrets > Actions > New repository secret** et ajouter :

**Secrets applicatifs (depuis .env)** :
```
PORT, NODE_ENV, MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE,
MYSQL_USER, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, JWT_SECRET,
JWT_EXPIRES_IN, BUNNY_API_KEY, BUNNY_STORAGE_ZONE, BUNNY_PULL_ZONE,
MAX_FILE_SIZE, UPLOAD_DIR, LOG_LEVEL
```

**Secrets de connexion VPS** :
```
VPS_HOST              # IP ou domaine du VPS (ex: 123.123.123.123)
VPS_USERNAME          # Utilisateur SSH (ex: root ou ton utilisateur)
VPS_SSH_KEY          # Clé SSH privée (contenu complet y compris les en-têtes)
VPS_PORT             # Port SSH (défaut: 22)
```

**Pour récupérer ta clé SSH :**
```bash
cat ~/.ssh/id_rsa
```
Copier tout le contenu y compris `-----BEGIN PRIVATE KEY-----` et `-----END PRIVATE KEY-----`

#### 2. Préparer ton VPS
Ton VPS doit avoir :
- **Node.js 24** (requis pour la production)
- npm ou yarn
- Docker et Docker Compose
- Git
- Accès SSH

#### 3. Setup initial sur le VPS
```bash
# Cloner le dépôt
cd ~
git clone https://github.com/loocist/JDMDEX-back.git
cd JDMDEX-back

# Installer les dépendances
npm install --production

# Créer le .env
cp .env.example .env
nano .env  # Éditer avec tes valeurs réelles

# Démarrer avec Docker Compose
docker-compose up -d
```

#### 4. Vérifier que tout fonctionne
1. Fais un petit changement de code
2. Push sur une branche `feature/*` → Lint + Test sur Node 22 et 24
3. Push sur `develop` → Lint + Test + Déploiement
4. Vérifie les logs dans l'onglet **Actions** de GitHub

### 🐛 Dépannage

#### Problèmes courants

1. **Échec de connexion SSH**
   - Vérifie que VPS_HOST, VPS_USERNAME, VPS_SSH_KEY sont corrects
   - Teste SSH manuellement : `ssh -i ~/.ssh/id_rsa user@host`
   - Assure-toi que la clé SSH est dans `~/.ssh/authorized_keys` sur le VPS

2. **Permission refusée**
   - Vérifie que l'utilisateur SSH a les droits d'écriture sur le répertoire de déploiement
   - Vérifie les permissions : `ls -la /home/username/JDMDEX-back`

3. **Variables d'environnement manquantes**
   - Vérifie que tous les secrets sont configurés dans GitHub
   - Consulte les logs du workflow pour voir quelle variable manque

4. **Version Node.js incompatible**
   - Le workflow utilise Node 22 et 24 pour les tests, Node 24 pour la production
   - Assure-toi que ton VPS a Node.js 24 : `node -v`

#### Visualisation des logs

**Logs GitHub Actions :**
- Va dans l'onglet **Actions** de ton dépôt GitHub
- Clique sur l'exécution du workflow
- Développe chaque étape pour voir les logs détaillés

**Logs VPS :**
```bash
# Logs Docker
docker-compose logs -f

# Status des conteneurs
docker-compose ps
```

### ⚙️ Personnalisation

#### Changer les versions de Node.js
Modifie la matrice dans le fichier workflow :
```yaml
strategy:
  matrix:
    node-version: ['22', '24']  # Ajoute/supprime des versions selon tes besoins
```
Le job de build/déploiement utilise Node.js 24 pour la production.

#### Ajouter de nouvelles variables d'environnement
1. Ajoute la variable dans `.env` et `.env.example`
2. Ajoute-la comme GitHub Secret avec le même nom
3. Ajoute-la dans l'étape de création du `.env` du workflow

#### Déployer sur plusieurs serveurs
Tu peux étendre le workflow pour déployer sur plusieurs serveurs en ajoutant des jobs de déploiement supplémentaires avec différents secrets.

### 🔒 Notes de Sécurité
- Ne commit **jamais** ton fichier `.env` dans git
- Utilise toujours les GitHub Secrets pour les informations sensibles
- Fait une rotation périodique de tes clés SSH
- Utilise des clés de déploiement avec des permissions limitées quand c'est possible
- Envisage d'utiliser les GitHub Environments pour différentes cibles (staging, production)

## Licence

MIT

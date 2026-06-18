# JDMDEX Backend

JDMDex API - Japanese car Pokédex backend avec authentification JWT et base de données MariaDB.

## Prérequis

- Node.js 18+
- Docker et Docker Compose
- MariaDB 10.11+

## Configuration

### 1. Cloner le dépôt et installer les dépendances

```bash
git clone <repository-url>
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

## Licence

MIT

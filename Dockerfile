# Dockerfile pour JDMDEX Backend
FROM node:18-alpine

# Répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY .env.example ./

# Installer les dépendances
RUN npm install --production

# Copier le code source
COPY src/ ./src/
COPY uploads/ ./uploads/

# Créer un répertoire pour les uploads s'il n'existe pas
RUN mkdir -p uploads && touch uploads/.gitkeep

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["node", "src/app.js"]

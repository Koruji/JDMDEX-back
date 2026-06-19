# 🚀 Déploiement JDMDEX-Back sur VPS Ubuntu

## Prérequis
- Un VPS Ubuntu vierge (IP: `37.187.219.212`)
- Clé SSH : `/home/loocist/.ssh/id_ed25519`
- Dépôt GitHub : `JDMDEX-back` (branche `develop`)

---

## ⚡ Déploiement en une commande

**Depuis TA machine locale**, exécute :

```bash
ssh -i /home/loocist/.ssh/id_ed25519 ubuntu@37.187.219.212 << 'EOF'
# =============================================
# SCRIPT DE DEPLOIEMENT AUTOMATIQUE
# =============================================

echo "=== [1/7] Mise à jour du système ==="
sudo apt update -y && sudo apt upgrade -y

echo ""
echo "=== [2/7] Installation Docker & dépendances ==="
sudo apt install -y docker.io docker-compose git

echo ""
echo "=== [3/7] Configuration Docker ==="
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
sudo systemctl start docker

echo ""
echo "=== [4/7] Clonage du projet ==="
cd /home/ubuntu
git clone https://github.com/Koruji/JDMDEX-back.git
cd JDMDEX-back
git checkout develop

echo ""
echo "=== [5/7] Configuration .env ==="
cat > .env << 'ENVEOF'
# Server
PORT=3000
NODE_ENV=production

# MariaDB
MYSQL_HOST=mariadb
MYSQL_PORT=3306
MYSQL_DATABASE=jdmdex
MYSQL_USER=jdmdex_user
MYSQL_PASSWORD=jdmdex_pass
MYSQL_ROOT_PASSWORD=rootpassword

# JWT
JWT_SECRET=supersecretjdmdexkey12345
JWT_EXPIRES_IN=24h

# Uploads
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Bunny CDN
BUNNY_API_KEY=48ecd756-d8dc-4d48-8578351aac39-fa6c-4757
BUNNY_STORAGE_ZONE=jdmdex
BUNNY_PULL_ZONE=jdmdex-cdn.loocist23.fr
ENVEOF

echo ""
echo "=== [6/7] Build & Lancement ==="
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo ""
echo "=== [7/7] Configuration finale ==="
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3306/tcp
sudo ufw --force enable

echo ""
echo "============================================="
echo "✅ DEPLOIEMENT TERMINÉ !"
echo "============================================="
echo ""
echo "📍 Application disponible sur : http://37.187.219.212:3000"
echo ""
echo "🔹 Commandes utiles :"
echo "   docker-compose logs -f app    # Logs de l'application"
echo "   docker-compose logs -f mariadb # Logs de la base de données"
echo "   docker ps -a                   # Liste des containers"
echo "   docker-compose down           # Arrêter tout"
echo "   docker-compose up -d          # Redémarrer"
echo ""
EOF
```

---

## 📝 Post-déploiement

### 1. Vérifier que tout fonctionne

```bash
# Sur le VPS
curl http://localhost:3000/api/health
# Doit retourner un JSON avec status: "ok"
```

### 2. Sécurité recommandée

```bash
# Changer les mots de passe MySQL (optionnel mais conseillé)
docker exec -it jdmdex-mariadb mysql -uroot -p
# Puis dans MySQL :
ALTER USER 'root'@'localhost' IDENTIFIED BY 'nouveau_mot_de_passe';
ALTER USER 'jdmdex_user'@'%' IDENTIFIED BY 'nouveau_mot_de_passe';
FLUSH PRIVILEGES;
```

### 3. Sauvegarde

```bash
# Sauvegarder la base de données
docker exec jdmdex-mariadb sh -c 'exec mysqldump --all-databases -uroot -p"$MYSQL_ROOT_PASSWORD"' > /home/ubuntu/backup-jdmdex-$(date +%F).sql
```

---

## 🔧 Dépannage

| Problème | Solution |
|----------|----------|
| Port 3000 bloqué | `sudo ufw allow 3000` |
| Docker non démarré | `sudo systemctl start docker` |
| Erreur de build | `docker-compose build --no-cache` |
| Base de données non accessible | Vérifier `docker-compose logs mariadb` |
| Variables d'environnement manquantes | Vérifier le fichier `.env` sur le serveur |

---

## 📌 Notes

- Le script utilise les mêmes identifiants que ton `.env` local
- **Pour un déploiement en production**, pense à :
  - Utiliser des mots de passe plus sécurisés
  - Configurer un reverse proxy (Nginx) avec HTTPS
  - Mettre en place des sauvegardes automatiques
  - Activer le fail2ban pour la sécurité SSH

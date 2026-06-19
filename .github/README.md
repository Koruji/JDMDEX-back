# GitHub Actions CI/CD Setup

This repository uses GitHub Actions for continuous integration and deployment.

## Workflow Description

The CI/CD workflow (`.github/workflows/ci-cd.yml`) performs the following:

1. **Lint & Test Job**
   - Runs on every push and pull request
   - Checks JavaScript syntax
   - Runs tests with Jest

2. **Deploy Job**
   - Runs only on push to `main`, `develop`, or `features/**` branches
   - Requires the Lint & Test job to pass first
   - Creates `.env` file from GitHub Secrets
   - Deploys to VPS via SSH
   - Restarts the PM2 service

## Setup Instructions

### 1. Configure GitHub Secrets

Go to **Settings > Secrets > Actions > New repository secret** and add the following:

#### Application Secrets (from .env)
```
PORT
NODE_ENV
MYSQL_HOST
MYSQL_PORT
MYSQL_DATABASE
MYSQL_USER
MYSQL_PASSWORD
MYSQL_ROOT_PASSWORD
JWT_SECRET
JWT_EXPIRES_IN
BUNNY_API_KEY
BUNNY_STORAGE_ZONE
BUNNY_PULL_ZONE
MAX_FILE_SIZE
UPLOAD_DIR
```

#### VPS Connection Secrets
```
VPS_HOST              # Your VPS IP or domain (e.g., 123.123.123.123)
VPS_USERNAME          # SSH username (e.g., root or your username)
VPS_SSH_KEY          # Private SSH key (full content including headers)
VPS_PORT             # SSH port (default: 22)
```

**To get your SSH key:**
```bash
cat ~/.ssh/id_rsa
```
Copy the entire content including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

### 2. Prepare Your VPS

Ensure your VPS has:
- Node.js (v20 recommended)
- npm or yarn
- PM2 (for process management)
- Git
- SSH access

Install PM2 globally:
```bash
sudo npm install -g pm2
pm2 startup
```

### 3. Initial VPS Setup

On your VPS, clone the repository and set up the initial deployment:

```bash
# Clone the repo
cd ~
git clone https://github.com/loocist/JDMDEX-back.git
cd JDMDEX-back

# Install dependencies
npm install --production

# Create .env file (or copy from .env.example)
cp .env.example .env
nano .env  # Edit with your actual values

# Start the service
pm2 start src/app.js --name jdmdex-back
pm2 save
pm2 startup
```

### 4. Verify Everything Works

1. Make a small change to your code
2. Push to a feature branch
3. Check the Actions tab in GitHub
4. Verify the deployment succeeded on your VPS

## Manual Deployment

If you need to deploy manually, you can use the deploy script:

```bash
# Make it executable (one time)
chmod +x scripts/deploy.sh

# Run it
./scripts/deploy.sh main
```

## Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Verify VPS_HOST, VPS_USERNAME, VPS_SSH_KEY are correct
   - Test SSH manually: `ssh -i ~/.ssh/id_rsa user@host`
   - Ensure the SSH key is added to `~/.ssh/authorized_keys` on the VPS

2. **Permission Denied**
   - Make sure the SSH user has write permissions to the deployment directory
   - Check file ownership: `ls -la /home/username/JDMDEX-back`

3. **Environment Variables Missing**
   - Verify all secrets are set in GitHub
   - Check the workflow logs for which variable is missing

4. **Node.js Version Mismatch**
   - The workflow uses Node.js 20
   - Ensure your VPS has Node.js 20 installed
   - Check with: `node -v`

### Viewing Logs

**GitHub Actions Logs:**
- Go to the Actions tab in your GitHub repository
- Click on the workflow run
- Expand each step to see detailed logs

**VPS Logs:**
```bash
# PM2 logs
pm2 logs jdmdex-back

# PM2 list
pm2 list

# System logs
journalctl -u node -f
```

## Customization

### Changing Node.js Version

Edit the `NODE_VERSION` environment variable in the workflow file:
```yaml
env:
  NODE_VERSION: '20'  # Change to your desired version
```

### Adding New Environment Variables

1. Add the variable to your `.env` and `.env.example` files
2. Add it as a GitHub Secret with the same name
3. Add it to the `.env` creation step in the workflow

### Deploying to Multiple Servers

You can extend the workflow to deploy to multiple servers by adding additional deploy jobs with different secrets.

## Security Notes

- Never commit your `.env` file to git
- Use GitHub Secrets for sensitive information
- Rotate SSH keys periodically
- Use deploy keys with limited permissions when possible
- Consider using GitHub Environments for different deployment targets (staging, production)

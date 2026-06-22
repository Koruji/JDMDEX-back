const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration du logger
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');
const LOG_FILE = process.env.LOG_FILE || path.join(LOG_DIR, 'api-errors.log');
const LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // error, warn, info, debug

// S'assurer que le dossier de logs existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Logger pour les erreurs API
 * Formate les logs avec timestamp, méthode, URL, status code et détails
 */
class ApiLogger {
  constructor() {
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    this.minLevel = this.logLevels[LOG_LEVEL] || 0;
  }

  /**
   * Vérifie si le niveau de log est activé
   */
  shouldLog(level) {
    return this.logLevels[level] <= this.minLevel;
  }

  /**
   * Formate le timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Formate un message de log
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0
      ? ` | ${JSON.stringify(meta)}`
      : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * Écrit dans le fichier de log
   */
  writeToFile(message) {
    try {
      const stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
      stream.write(`${message}\n`);
      stream.end();
    } catch (error) {
      // Si on ne peut pas écrire dans le fichier, afficher sur la console
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Log une erreur d'API
   * @param {string} message - Message d'erreur
   * @param {Object} options - Options de log
   * @param {string} options.method - Méthode HTTP (GET, POST, etc.)
   * @param {string} options.path - Chemin de l'API
   * @param {number} options.statusCode - Code de statut HTTP
   * @param {Object} options.error - Objet d'erreur complet
   * @param {Object} options.requestBody - Corps de la requête
   * @param {Object} options.user - Informations utilisateur
   */
  error(message, options = {}) {
    if (!this.shouldLog('error')) return;

    const {
      method = 'UNKNOWN',
      path: apiPath = 'unknown',
      statusCode = 500,
      error = null,
      requestBody = null,
      user = null,
    } = options;

    const meta = {
      method,
      path: apiPath,
      statusCode,
      ...(error && { error: error.message || String(error) }),
      ...(error && error.stack && { stack: error.stack.split('\n')[0] }),
      ...(user && { userId: user.id, username: user.username }),
      ...(requestBody && { requestBody: JSON.stringify(requestBody).substring(0, 200) }),
    };

    const logMessage = this.formatMessage('error', message, meta);

    // Écrire dans le fichier
    this.writeToFile(logMessage);

    // Also log to console for immediate visibility
    console.error(logMessage);
  }

  /**
   * Log un avertissement
   */
  warn(message, options = {}) {
    if (!this.shouldLog('warn')) return;

    const meta = {
      method: options.method,
      path: options.path,
      statusCode: options.statusCode,
    };

    const logMessage = this.formatMessage('warn', message, meta);
    this.writeToFile(logMessage);
    console.warn(logMessage);
  }

  /**
   * Log une information
   */
  info(message, options = {}) {
    if (!this.shouldLog('info')) return;

    const meta = {
      method: options.method,
      path: options.path,
      statusCode: options.statusCode,
    };

    const logMessage = this.formatMessage('info', message, meta);
    this.writeToFile(logMessage);
    console.info(logMessage);
  }

  /**
   * Log pour le debug
   */
  debug(message, options = {}) {
    if (!this.shouldLog('debug')) return;

    const meta = {
      method: options.method,
      path: options.path,
      statusCode: options.statusCode,
    };

    const logMessage = this.formatMessage('debug', message, meta);
    this.writeToFile(logMessage);
    console.debug(logMessage);
  }

  /**
   * Log une erreur d'appel API externe (Bunny CDN, etc.)
   */
  externalApiError(serviceName, error, options = {}) {
    const {
      method = 'UNKNOWN',
      url = 'unknown',
      requestData = null,
    } = options;

    const message = `External API Error [${serviceName}]`;

    const meta = {
      service: serviceName,
      method,
      url,
      error: error.message || String(error),
      ...(error.response && {
        status: error.response.status,
        statusText: error.response.statusText,
        responseData: JSON.stringify(error.response.data).substring(0, 200),
      }),
      ...(requestData && { requestData: JSON.stringify(requestData).substring(0, 200) }),
    };

    const logMessage = this.formatMessage('error', message, meta);
    this.writeToFile(logMessage);
    console.error(logMessage);
  }

  /**
   * Log une erreur de base de données
   */
  databaseError(error, options = {}) {
    const {
      query = 'unknown',
      operation = 'query',
    } = options;

    const message = `Database Error [${operation}]`;

    const meta = {
      operation,
      query: query.substring(0, 200),
      error: error.message || String(error),
      ...(error.code && { code: error.code }),
      ...(error.errno && { errno: error.errno }),
    };

    const logMessage = this.formatMessage('error', message, meta);
    this.writeToFile(logMessage);
    console.error(logMessage);
  }
}

// Exporter une instance singleton
const logger = new ApiLogger();

module.exports = logger;

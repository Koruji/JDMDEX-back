const logger = require('../utils/logger');

/**
 * Middleware pour logger toutes les requêtes entrantes
 * (optionnel, pour le debug)
 */
function requestLogger(req, res, next) {
  res.on('finish', () => {
    // On ne log que les erreurs (status >= 400) ou en mode debug
    if (res.statusCode >= 400) {
      logger.error('API Request Failed', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        user: req.user ? { id: req.user.id, username: req.user.username } : null,
      });
    }
  });

  next();
}

/**
 * Middleware pour capturer et logger les erreurs non gérées
 * Doit être placé après toutes les routes
 */
// eslint-disable-next-line consistent-return, no-unused-vars
function errorHandler(err, req, res, next) {
  // Si la réponse a déjà été envoyée, on passe
  if (res.headersSent) {
    return next(err);
  }

  // Déterminer le status code
  const statusCode = err.statusCode || err.status || 500;

  // Logger l'erreur
  logger.error('Unhandled API Error', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: err,
    user: req.user ? { id: req.user.id, username: req.user.username } : null,
    requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : null,
  });

  // Envoyer la réponse d'erreur
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error',
  });
}

/**
 * Middleware pour logger spécifiquement les erreurs 404
 */
// eslint-disable-next-line consistent-return, no-unused-vars
function notFoundHandler(req, res, next) {
  logger.error('Route Not Found', {
    method: req.method,
    path: req.originalUrl,
    statusCode: 404,
    user: req.user ? { id: req.user.id, username: req.user.username } : null,
  });

  res.status(404).json({ error: 'Route not found' });
}

/**
 * Wrapper pour les contrôleurs async qui log les erreurs automatiquement
 * @param {Function} fn - Fonction contrôleur async
 * @returns {Function} Middleware Express
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      logger.error('Async Handler Error', {
        method: req.method,
        path: req.originalUrl,
        statusCode: 500,
        error: err,
        user: req.user ? { id: req.user.id, username: req.user.username } : null,
      });
      next(err);
    });
  };
}

module.exports = {
  requestLogger,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};

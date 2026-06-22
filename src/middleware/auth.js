const jwt = require('jsonwebtoken');
require('dotenv').config();
const logger = require('../utils/logger');

/**
 * Middleware pour vérifier le token JWT
 * Ajoute l'utilisateur à req.user si le token est valide
 */
// eslint-disable-next-line consistent-return
function authenticateToken(req, res, next) {
  // Récupérer le token du header Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    logger.error('Authentication failed: No token provided', {
      method: req.method,
      path: req.originalUrl,
      statusCode: 401,
    });
    return res.status(401).json({
      error: 'Access denied. No token provided.',
    });
  }

  try {
    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication failed: Invalid or expired token', {
      method: req.method,
      path: req.originalUrl,
      statusCode: 403,
      error,
    });
    return res.status(403).json({
      error: 'Invalid or expired token.',
    });
  }
}

/**
 * Middleware pour vérifier que l'utilisateur a le droit d'accéder à une ressource
 * Utilisé pour les routes qui nécessitent que l'utilisateur soit le propriétaire
 */
function checkOwnership(resourceUserId) {
  // eslint-disable-next-line consistent-return
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Authorization failed: Not authenticated', {
        method: req.method,
        path: req.originalUrl,
        statusCode: 401,
      });
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    if (req.user.id !== resourceUserId) {
      logger.error('Authorization failed: User does not own resource', {
        method: req.method,
        path: req.originalUrl,
        statusCode: 403,
        user: req.user ? { id: req.user.id } : null,
        resourceUserId,
      });
      return res.status(403).json({
        error: 'Access denied. You do not own this resource.',
      });
    }

    next();
  };
}

/**
 * Middleware pour générer un token JWT
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  );
}

module.exports = {
  authenticateToken,
  checkOwnership,
  generateToken,
};

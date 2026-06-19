const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const pool = require('../db/database');
const { generateToken } = require('../middleware/auth');
const { uploadFile, deleteFile, generateProfilePath } = require('../services/bunny');
const logger = require('../utils/logger');

const router = express.Router();

const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const allowedMime = file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream';
    if (!allowedMime && !allowedExts.test(file.originalname)) {
      return cb(new Error('Only images are allowed'));
    }
    cb(null, true);
  },
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Username or email already exists
 */
router.post('/register', profileUpload.single('profil_img'), async (req, res) => {
  const { username, email, password } = req.body;

  // Validation des champs obligatoires
  if (!username || !email || !password) {
    return res.status(400).json({
      error: 'Username, email, and password are required.'
    });
  }

  // Validation du format email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'Invalid email format.'
    });
  }

  // Validation de la longueur du mot de passe
  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must be at least 6 characters long.'
    });
  }

  try {
    const connection = await pool.getConnection();
    
    // Vérifier si l'utilisateur existe déjà
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'Username or email already exists.'
      });
    }

    // Hacher le mot de passe
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const userId = result.insertId;
    let profilImgUrl = null;

    // Upload de l'image de profil si fournie
    if (req.file) {
      const filePath = generateProfilePath(userId, req.file.originalname);
      const url = await uploadFile(req.file.buffer, filePath);
      profilImgUrl = url;
      
      // Mettre à jour l'utilisateur avec l'URL de l'image de profil
      await connection.query(
        'UPDATE users SET profil_img_url = ? WHERE id = ?',
        [profilImgUrl, userId]
      );
    }

    // Récupérer l'utilisateur créé
    const [user] = await connection.query(
      'SELECT id, username, email, profil_img_url FROM users WHERE id = ?',
      [userId]
    );

    // Générer un token JWT
    const token = generateToken(user[0]);

    connection.release();

    res.status(201).json({
      user: user[0],
      token
    });
  } catch (error) {
    logger.error('Registration error', {
      method: 'POST',
      path: '/api/auth/register',
      statusCode: 500,
      error: error,
      user: req.body ? { username: req.body.username, email: req.body.email } : null
    });
    res.status(500).json({
      error: 'An error occurred during registration.'
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login an existing user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Validation des champs obligatoires
  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password are required.'
    });
  }

  try {
    const connection = await pool.getConnection();
    
    // Trouver l'utilisateur par username ou email
    const [users] = await connection.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials.'
      });
    }

    const user = users[0];

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid credentials.'
      });
    }

    // Générer un token JWT
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email
    });

    connection.release();

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    });
  } catch (error) {
    logger.error('Login error', {
      method: 'POST',
      path: '/api/auth/login',
      statusCode: 500,
      error: error,
      user: req.body ? { username: req.body.username } : null
    });
    res.status(500).json({
      error: 'An error occurred during login.'
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No token provided
 *       403:
 *         description: Invalid or expired token
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'No token provided.'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, email FROM users WHERE id = ?',
      [decoded.id]
    );
    
    connection.release();

    if (users.length === 0) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    res.json({
      user: users[0]
    });
  } catch (error) {
    logger.error('Get me error', {
      method: 'GET',
      path: '/api/auth/me',
      statusCode: 403,
      error: error
    });
    res.status(403).json({
      error: 'Invalid or expired token.'
    });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - id
 *         - username
 *         - email
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *           example: 1
 *         username:
 *           type: string
 *           description: User username
 *           example: john_doe
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *           example: john@example.com
 */

module.exports = router;

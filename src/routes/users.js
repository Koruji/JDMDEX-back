const express = require('express');
const multer = require('multer');
const pool = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadFile, deleteFile, generateProfilePath } = require('../services/bunny');
const logger = require('../utils/logger');

const router = express.Router();

const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const allowedMime = file.mimetype.startsWith('image/')
      || file.mimetype === 'application/octet-stream';
    if (!allowedMime && !allowedExts.test(file.originalname)) {
      return cb(new Error('Only images are allowed'));
    }
    return cb(null, true);
  },
});

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: User ID
 *                 username:
 *                   type: string
 *                   description: Username
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: User email
 *                 social_media:
 *                   type: string
 *                   nullable: true
 *                   description: Social media handle
 *                 profil_img_url:
 *                   type: string
 *                   nullable: true
 *                   description: Profile image URL
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [users] = await connection.query(
      `SELECT id, username, email, social_media, profil_img_url, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.user.id],
    );

    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(users[0]);
  } catch (error) {
    logger.error('Error fetching user profile', {
      method: 'GET',
      path: '/api/users/me',
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
    });
    res.status(500).json({ error: 'An error occurred while fetching user profile.' });
  }
});

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email
 *               social_media:
 *                 type: string
 *                 description: Social media handle
 *               profil_img_url:
 *                 type: string
 *                 description: Profile image URL
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *                 social_media:
 *                   type: string
 *                   nullable: true
 *                 profil_img_url:
 *                   type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.put(
  '/me',
  authenticateToken,
  profileUpload.single('profil_img'),
  async (req, res) => {
    const { username, email, social_media } = req.body;

    if (!username && !email && !req.file) {
      return res.status(400).json({
        error: 'At least username, email, or profil_img must be provided.',
      });
    }

    try {
      const connection = await pool.getConnection();

      // Vérifier si le username ou email existe déjà (si fourni)
      if (username) {
        const [existing] = await connection.query(
          'SELECT id FROM users WHERE username = ? AND id != ?',
          [username, req.user.id],
        );
        if (existing.length > 0) {
          return res.status(409).json({ error: 'Username already exists.' });
        }
      }

      if (email) {
        const [existing] = await connection.query(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, req.user.id],
        );
        if (existing.length > 0) {
          return res.status(409).json({ error: 'Email already exists.' });
        }
      }

      // Gérer l'upload de l'image de profil
      let profilImgUrl = null;
      let oldProfilImgPath = null;

      if (req.file) {
      // Récupérer l'ancienne image de profil pour la supprimer
        const [oldUser] = await connection.query(
          'SELECT profil_img_url FROM users WHERE id = ?',
          [req.user.id],
        );

        if (oldUser[0] && oldUser[0].profil_img_url) {
          const cdnUrl = process.env.BUNNY_PULL_ZONE || 'jdmdex-cdn.loocist23.fr';
          oldProfilImgPath = oldUser[0].profil_img_url.replace(`https://${cdnUrl}/`, '');
        }

        // Upload de la nouvelle image
        const filePath = generateProfilePath(req.user.id, req.file.originalname);
        profilImgUrl = await uploadFile(req.file.buffer, filePath);

        // Supprimer l'ancienne image après upload réussi
        if (oldProfilImgPath) {
          await deleteFile(oldProfilImgPath).catch(() => {});
        }
      }

      // Mettre à jour l'utilisateur
      await connection.query(
        `UPDATE users SET
        username = COALESCE(?, username),
        email = COALESCE(?, email),
        social_media = COALESCE(?, social_media),
        profil_img_url = COALESCE(?, profil_img_url),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
        [username, email, social_media, profilImgUrl, req.user.id],
      );

      // Récupérer l'utilisateur mis à jour
      const [users] = await connection.query(
        `SELECT id, username, email, social_media, profil_img_url,
          created_at, updated_at FROM users WHERE id = ?`,
        [req.user.id],
      );

      connection.release();

      res.json(users[0]);
    } catch (error) {
      logger.error('Error updating user profile', {
        method: 'PUT',
        path: '/api/users/me',
        statusCode: 500,
        error,
        user: req.user ? { id: req.user.id } : null,
      });
      res.status(500).json({ error: 'An error occurred while updating user profile.' });
    }
  },
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user profile by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 social_media:
 *                   type: string
 *                   nullable: true
 *                 profil_img_url:
 *                   type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
 */
router.get('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Récupérer uniquement les infos publiques (sans email)
    const [users] = await connection.query(
      'SELECT id, username, social_media, profil_img_url, created_at FROM users WHERE id = ?',
      [req.params.id],
    );

    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(users[0]);
  } catch (error) {
    logger.error('Error fetching user by ID', {
      method: 'GET',
      path: `/api/users/${req.params.id}`,
      statusCode: 500,
      error,
    });
    res.status(500).json({ error: 'An error occurred while fetching user.' });
  }
});

module.exports = router;

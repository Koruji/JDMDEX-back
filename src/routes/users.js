const express = require('express');
const pool = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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
 *                 user_id:
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
      'SELECT user_id, username, email, social_media, profil_img_url, created_at, updated_at FROM users WHERE user_id = ?',
      [req.user.id]
    );
    
    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
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
 *                 user_id:
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
router.put('/me', authenticateToken, async (req, res) => {
  const { username, email, social_media, profil_img_url } = req.body;

  if (!username && !email) {
    return res.status(400).json({ error: 'At least username or email must be provided.' });
  }

  try {
    const connection = await pool.getConnection();
    
    // Vérifier si le username ou email existe déjà (si fourni)
    if (username) {
      const [existing] = await connection.query(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        [username, req.user.id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Username already exists.' });
      }
    }

    if (email) {
      const [existing] = await connection.query(
        'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
        [email, req.user.id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Email already exists.' });
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
       WHERE user_id = ?`,
      [username, email, social_media, profil_img_url, req.user.id]
    );

    // Récupérer l'utilisateur mis à jour
    const [users] = await connection.query(
      'SELECT user_id, username, email, social_media, profil_img_url, created_at, updated_at FROM users WHERE user_id = ?',
      [req.user.id]
    );
    
    connection.release();

    res.json(users[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'An error occurred while updating user profile.' });
  }
});

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
 *                 user_id:
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
      'SELECT user_id, username, social_media, profil_img_url, created_at FROM users WHERE user_id = ?',
      [req.params.id]
    );
    
    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'An error occurred while fetching user.' });
  }
});

module.exports = router;

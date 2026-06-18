const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event management
 */

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: List of all events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Event'
 */
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [events] = await connection.query(
      `SELECT e.id, e.name, e.date_start, e.date_end, e.location, e.type, e.notes, 
              u.user_id, u.username, u.profil_img_url,
              e.created_at, e.updated_at,
              COUNT(ec.id) as comments_count
       FROM events e
       LEFT JOIN users u ON e.user_id = u.user_id
       LEFT JOIN event_comments ec ON e.id = ec.event_id
       GROUP BY e.id
       ORDER BY e.date_start ASC`
    );
    
    const result = events.map(event => ({
      ...event,
      comments_count: event.comments_count || 0
    }));
    
    connection.release();
    res.json(result);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'An error occurred while fetching events.' });
  }
});

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - dateStart
 *               - dateEnd
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Event name
 *               dateStart:
 *                 type: string
 *                 format: date-time
 *                 description: Start date
 *               dateEnd:
 *                 type: string
 *                 format: date-time
 *                 description: End date
 *               location:
 *                 type: string
 *                 description: Event location
 *               type:
 *                 type: string
 *                 enum: [rasso, expo, autre]
 *                 description: Event type
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Event created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       401:
 *         description: Not authenticated
 */
router.post('/', authenticateToken, async (req, res) => {
  const { name, dateStart, dateEnd, location, type, notes } = req.body;

  if (!name || !dateStart || !dateEnd || !type) {
    return res.status(400).json({ 
      error: 'name, dateStart, dateEnd, and type are required.' 
    });
  }

  if (!['rasso', 'expo', 'autre'].includes(type)) {
    return res.status(400).json({ 
      error: 'type must be one of: rasso, expo, autre' 
    });
  }

  try {
    const connection = await pool.getConnection();
    
    const eventId = uuidv4();
    
    await connection.query(
      `INSERT INTO events 
       (id, name, date_start, date_end, location, type, notes, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, name, new Date(dateStart), new Date(dateEnd), 
       location, type, notes, req.user.id]
    );

    // Récupérer l'événement créé
    const [events] = await connection.query(
      `SELECT e.id, e.name, e.date_start as dateStart, e.date_end as dateEnd, 
              e.location, e.type, e.notes, e.user_id, e.created_at, e.updated_at,
              u.username, u.profil_img_url
       FROM events e
       LEFT JOIN users u ON e.user_id = u.user_id
       WHERE e.id = ?`,
      [eventId]
    );
    
    connection.release();

    // Formater les dates pour la réponse
    const event = {
      ...events[0],
      dateStart: events[0].dateStart,
      dateEnd: events[0].dateEnd
    };

    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'An error occurred while creating event.' });
  }
});

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event details with comments
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Event'
 *                 - type: object
 *                   properties:
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EventComment'
 *       404:
 *         description: Event not found
 */
router.get('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [events] = await connection.query(
      `SELECT e.id, e.name, e.date_start as dateStart, e.date_end as dateEnd, 
              e.location, e.type, e.notes, e.user_id, e.created_at, e.updated_at,
              u.user_id as owner_id, u.username as owner_username, u.profil_img_url as owner_profil_img_url
       FROM events e
       LEFT JOIN users u ON e.user_id = u.user_id
       WHERE e.id = ?`,
      [req.params.id]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Récupérer les commentaires
    const [comments] = await connection.query(
      `SELECT ec.id, ec.event_id, ec.user_id, ec.text, ec.created_at,
              u.username, u.profil_img_url
       FROM event_comments ec
       LEFT JOIN users u ON ec.user_id = u.user_id
       WHERE ec.event_id = ?
       ORDER BY ec.created_at ASC`,
      [req.params.id]
    );
    
    const event = {
      ...events[0],
      comments: comments.map(c => ({
        id: c.id,
        event_id: c.event_id,
        user_id: c.user_id,
        text: c.text,
        created_at: c.created_at,
        username: c.username,
        profil_img_url: c.profil_img_url
      }))
    };
    
    connection.release();
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'An error occurred while fetching event.' });
  }
});

/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Update an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               dateStart:
 *                 type: string
 *                 format: date-time
 *               dateEnd:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [rasso, expo, autre]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not owner
 *       404:
 *         description: Event not found
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, dateStart, dateEnd, location, type, notes } = req.body;

  try {
    const connection = await pool.getConnection();
    
    // Vérifier que l'événement existe et appartient à l'utilisateur
    const [events] = await connection.query(
      'SELECT id, user_id FROM events WHERE id = ?',
      [req.params.id]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    
    if (events[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this event.' });
    }

    // Mettre à jour l'événement
    await connection.query(
      `UPDATE events SET
        name = COALESCE(?, name),
        date_start = COALESCE(?, date_start),
        date_end = COALESCE(?, date_end),
        location = COALESCE(?, location),
        type = COALESCE(?, type),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, dateStart ? new Date(dateStart) : null, 
       dateEnd ? new Date(dateEnd) : null, location, type, notes, req.params.id]
    );

    // Récupérer l'événement mis à jour
    const [updatedEvents] = await connection.query(
      `SELECT e.id, e.name, e.date_start as dateStart, e.date_end as dateEnd, 
              e.location, e.type, e.notes, e.user_id, e.created_at, e.updated_at
       FROM events e
       WHERE e.id = ?`,
      [req.params.id]
    );
    
    connection.release();
    res.json(updatedEvents[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'An error occurred while updating event.' });
  }
});

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       204:
 *         description: Event deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not owner
 *       404:
 *         description: Event not found
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Vérifier que l'événement existe et appartient à l'utilisateur
    const [events] = await connection.query(
      'SELECT id, user_id FROM events WHERE id = ?',
      [req.params.id]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    
    if (events[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this event.' });
    }

    // Supprimer l'événement (et ses commentaires via CASCADE)
    await connection.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    
    connection.release();
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'An error occurred while deleting event.' });
  }
});

// ==================== EVENT COMMENTS ====================

/**
 * @swagger
 * /api/events/{id}/comments:
 *   get:
 *     summary: Get all comments for an event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EventComment'
 *       404:
 *         description: Event not found
 */
router.get('/:id/comments', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Vérifier que l'événement existe
    const [events] = await connection.query(
      'SELECT id FROM events WHERE id = ?',
      [req.params.id]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const [comments] = await connection.query(
      `SELECT ec.id, ec.event_id, ec.user_id, ec.text, ec.created_at,
              u.username, u.profil_img_url
       FROM event_comments ec
       LEFT JOIN users u ON ec.user_id = u.user_id
       WHERE ec.event_id = ?
       ORDER BY ec.created_at ASC`,
      [req.params.id]
    );
    
    const result = comments.map(c => ({
      id: c.id,
      event_id: c.event_id,
      user_id: c.user_id,
      text: c.text,
      created_at: c.created_at,
      username: c.username,
      profil_img_url: c.profil_img_url
    }));
    
    connection.release();
    res.json(result);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'An error occurred while fetching comments.' });
  }
});

/**
 * @swagger
 * /api/events/{id}/comments:
 *   post:
 *     summary: Add a comment to an event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Comment text
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventComment'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Event not found
 */
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required.' });
  }

  try {
    const connection = await pool.getConnection();
    
    // Vérifier que l'événement existe
    const [events] = await connection.query(
      'SELECT id FROM events WHERE id = ?',
      [req.params.id]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const commentId = uuidv4();
    
    await connection.query(
      'INSERT INTO event_comments (id, event_id, user_id, text) VALUES (?, ?, ?, ?)',
      [commentId, req.params.id, req.user.id, text]
    );

    // Récupérer le commentaire créé
    const [comments] = await connection.query(
      `SELECT ec.id, ec.event_id, ec.user_id, ec.text, ec.created_at,
              u.username, u.profil_img_url
       FROM event_comments ec
       LEFT JOIN users u ON ec.user_id = u.user_id
       WHERE ec.id = ?`,
      [commentId]
    );
    
    connection.release();

    res.status(201).json({
      id: comments[0].id,
      event_id: comments[0].event_id,
      user_id: comments[0].user_id,
      text: comments[0].text,
      created_at: comments[0].created_at,
      username: comments[0].username,
      profil_img_url: comments[0].profil_img_url
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'An error occurred while creating comment.' });
  }
});

/**
 * @swagger
 * /api/events/{id}/comments/{commentId}:
 *   put:
 *     summary: Update a comment
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Updated comment text
 *     responses:
 *       200:
 *         description: Comment updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventComment'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not owner
 *       404:
 *         description: Comment not found
 */
router.put('/:id/comments/:commentId', authenticateToken, async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required.' });
  }

  try {
    const connection = await pool.getConnection();
    
    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const [comments] = await connection.query(
      'SELECT id, user_id FROM event_comments WHERE id = ? AND event_id = ?',
      [req.params.commentId, req.params.id]
    );
    
    if (comments.length === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }
    
    if (comments[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this comment.' });
    }

    await connection.query(
      'UPDATE event_comments SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [text, req.params.commentId]
    );

    // Récupérer le commentaire mis à jour
    const [updatedComments] = await connection.query(
      `SELECT ec.id, ec.event_id, ec.user_id, ec.text, ec.created_at,
              u.username, u.profil_img_url
       FROM event_comments ec
       LEFT JOIN users u ON ec.user_id = u.user_id
       WHERE ec.id = ?`,
      [req.params.commentId]
    );
    
    connection.release();
    
    res.json({
      id: updatedComments[0].id,
      event_id: updatedComments[0].event_id,
      user_id: updatedComments[0].user_id,
      text: updatedComments[0].text,
      created_at: updatedComments[0].created_at,
      username: updatedComments[0].username,
      profil_img_url: updatedComments[0].profil_img_url
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'An error occurred while updating comment.' });
  }
});

/**
 * @swagger
 * /api/events/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       204:
 *         description: Comment deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not owner
 *       404:
 *         description: Comment not found
 */
router.delete('/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const [comments] = await connection.query(
      'SELECT id, user_id FROM event_comments WHERE id = ? AND event_id = ?',
      [req.params.commentId, req.params.id]
    );
    
    if (comments.length === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }
    
    if (comments[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this comment.' });
    }

    await connection.query('DELETE FROM event_comments WHERE id = ?', [req.params.commentId]);
    
    connection.release();
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'An error occurred while deleting comment.' });
  }
});

module.exports = router;

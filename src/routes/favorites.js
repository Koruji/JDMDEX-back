const express = require('express');
const pool = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Favorites
 *   description: User favorites management
 */

/**
 * @swagger
 * /api/users/favorites:
 *   get:
 *     summary: Get all favorite cars for the current user
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of favorite cars
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favorites:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   description: Array of car IDs
 *                 cars:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Car'
 *                   description: Array of car details
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Récupérer les IDs des favoris
    const [favorites] = await connection.query(
      'SELECT car_id FROM favorites WHERE user_id = ?',
      [req.user.id]
    );
    
    const favoriteCarIds = favorites.map(f => f.car_id);
    
    // Récupérer les détails des voitures
    let cars = [];
    if (favoriteCarIds.length > 0) {
      const [carsResult] = await connection.query(
        `SELECT c.id, c.name, c.brand, c.year, c.horsepower, c.engine, 
                c.mileage, c.owner, c.location, c.latitude, c.longitude,
                c.user_id, c.created_at, c.updated_at
         FROM cars c
         WHERE c.id IN (?)
         ORDER BY c.created_at DESC`,
        [favoriteCarIds]
      );
      cars = carsResult;
    }
    
    connection.release();

    res.json({
      favorites: favoriteCarIds,
      cars: cars
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'An error occurred while fetching favorites.' });
  }
});

/**
 * @swagger
 * /api/users/favorites/{carId}:
 *   post:
 *     summary: Add a car to favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *     responses:
 *       201:
 *         description: Car added to favorites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isFavorite:
 *                   type: boolean
 *                 carId:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Car not found
 */
router.post('/:carId', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Vérifier que la voiture existe
    const [cars] = await connection.query(
      'SELECT id FROM cars WHERE id = ?',
      [req.params.carId]
    );
    
    if (cars.length === 0) {
      return res.status(404).json({ error: 'Car not found.' });
    }

    // Ajouter aux favoris
    await connection.query(
      'INSERT INTO favorites (user_id, car_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE car_id = car_id',
      [req.user.id, req.params.carId]
    );
    
    connection.release();

    res.status(201).json({
      success: true,
      isFavorite: true,
      carId: parseInt(req.params.carId)
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'An error occurred while adding favorite.' });
  }
});

/**
 * @swagger
 * /api/users/favorites/{carId}:
 *   delete:
 *     summary: Remove a car from favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *     responses:
 *       200:
 *         description: Car removed from favorites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isFavorite:
 *                   type: boolean
 *                 carId:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Favorite not found
 */
router.delete('/:carId', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'DELETE FROM favorites WHERE user_id = ? AND car_id = ?',
      [req.user.id, req.params.carId]
    );
    
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Favorite not found.' });
    }

    res.json({
      success: true,
      isFavorite: false,
      carId: parseInt(req.params.carId)
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'An error occurred while removing favorite.' });
  }
});

/**
 * @swagger
 * /api/users/favorites/check/{carId}:
 *   get:
 *     summary: Check if a car is in favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *     responses:
 *       200:
 *         description: Favorite status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFavorite:
 *                   type: boolean
 *                 carId:
 *                   type: integer
 */
router.get('/check/:carId', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [favorites] = await connection.query(
      'SELECT car_id FROM favorites WHERE user_id = ? AND car_id = ?',
      [req.user.id, req.params.carId]
    );
    
    connection.release();

    res.json({
      isFavorite: favorites.length > 0,
      carId: parseInt(req.params.carId)
    });
  } catch (error) {
    console.error('Error checking favorite:', error);
    res.status(500).json({ error: 'An error occurred while checking favorite.' });
  }
});

module.exports = router;

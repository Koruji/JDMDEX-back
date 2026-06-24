const express = require('express');
const multer = require('multer');
const pool = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadFile, deleteFile, generateFilePath } = require('../services/bunny');
const logger = require('../utils/logger');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
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

const toInt = (v) => ((v === '' || v == null) ? null : (parseInt(v, 10) || null));
const toFloat = (v) => ((v === '' || v == null) ? null : (parseFloat(v) || null));
const toStr = (v) => ((v === '' || v == null) ? null : String(v));

const BUNNY_PULL_ZONE = process.env.BUNNY_PULL_ZONE || 'jdmdex-cdn.loocist23.fr';

/**
 * @swagger
 * tags:
 *   name: Cars
 *   description: Car management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Car:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Car ID
 *           example: 1
 *         name:
 *           type: string
 *           description: Car name
 *           example: Nissan Skyline GT-R
 *         brand:
 *           type: string
 *           description: Car brand
 *           example: Nissan
 *         year:
 *           type: integer
 *           description: Manufacturing year
 *           example: 1999
 *         horsepower:
 *           type: integer
 *           description: Engine horsepower
 *           example: 280
 *         engine:
 *           type: string
 *           description: Engine specifications
 *           example: RB26DETT 2.6L Twin-Turbo
 *         mileage:
 *           type: integer
 *           description: Car mileage in km
 *           example: 50000
 *         owner:
 *           type: string
 *           description: Car owner name
 *           example: John Doe
 *         location:
 *           type: string
 *           description: Car location
 *           example: Tokyo, Japan
 *         latitude:
 *           type: number
 *           format: float
 *           description: GPS latitude
 *           example: 35.6895
 *         longitude:
 *           type: number
 *           format: float
 *           description: GPS longitude
 *           example: 139.6917
 *         user_id:
 *           type: integer
 *           description: Owner user ID
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         photos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Photo'
 *     Photo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Photo ID
 *           example: 1
 *         car_id:
 *           type: integer
 *           description: Parent car ID
 *           example: 1
 *         filename:
 *           type: string
 *           description: Photo filename
 *           example: 123456789.jpg
 *         is_primary:
 *           type: boolean
 *           description: Is this the primary photo
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Upload timestamp
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *           example: Car not found
 */

async function carWithPhotos(car, connection) {
  const [photos] = await connection.query(
    'SELECT * FROM photos WHERE car_id = ? ORDER BY is_primary DESC, created_at ASC',
    [car.id],
  );
  const photosWithUrls = photos.map((photo) => ({
    ...photo,
    url: `https://${BUNNY_PULL_ZONE}/${photo.filename}`,
  }));
  return { ...car, photos: photosWithUrls };
}

/**
 * @swagger
 * /api/cars:
 *   get:
 *     summary: Get all cars for the authenticated user
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's cars with photos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Car'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/cars - Liste toutes les voitures de l'utilisateur connecté
router.get('/', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [cars] = await connection.query(
      'SELECT * FROM cars WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id],
    );

    const result = await Promise.all(
      cars.map(async (car) => await carWithPhotos(car, connection)),
    );

    connection.release();
    res.json(result);
  } catch (error) {
    logger.error('Error fetching cars', {
      method: 'GET',
      path: '/api/cars',
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
    });
    res.status(500).json({ error: 'An error occurred while fetching cars.' });
  }
});

/**
 * @swagger
 * /api/cars/{id}:
 *   get:
 *     summary: Get a specific car by ID
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *     responses:
 *       200:
 *         description: Car details with photos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Car'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Car not found or not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/cars/:id - Récupérer une voiture spécifique
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [cars] = await connection.query(
      'SELECT * FROM cars WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );

    if (cars.length === 0) {
      return res.status(404).json({ error: 'Car not found or not authorized.' });
    }

    const car = await carWithPhotos(cars[0], connection);
    connection.release();

    res.json(car);
  } catch (error) {
    logger.error('Error fetching car by ID', {
      method: 'GET',
      path: `/api/cars/${req.params.id}`,
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
    });
    res.status(500).json({ error: 'An error occurred while fetching the car.' });
  }
});

/**
 * @swagger
 * /api/cars:
 *   post:
 *     summary: Create a new car
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Car name (required)
 *                 example: Nissan Skyline GT-R
 *               brand:
 *                 type: string
 *                 description: Car brand
 *                 example: Nissan
 *               year:
 *                 type: integer
 *                 description: Manufacturing year
 *                 example: 1999
 *               horsepower:
 *                 type: integer
 *                 description: Engine horsepower
 *                 example: 280
 *               engine:
 *                 type: string
 *                 description: Engine specifications
 *                 example: RB26DETT 2.6L Twin-Turbo
 *               mileage:
 *                 type: integer
 *                 description: Car mileage in km
 *                 example: 50000
 *               owner:
 *                 type: string
 *                 description: Car owner name
 *                 example: John Doe
 *               location:
 *                 type: string
 *                 description: Car location
 *                 example: Tokyo, Japan
 *               latitude:
 *                 type: number
 *                 format: float
 *                 description: GPS latitude
 *                 example: 35.6895
 *               longitude:
 *                 type: number
 *                 format: float
 *                 description: GPS longitude
 *                 example: 139.6917
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Car created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Car'
 *       400:
 *         description: Name is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 */
// POST /api/cars - Créer une nouvelle voiture avec photos optionnelles
router.post('/', authenticateToken, upload.array('photos', 10), async (req, res) => {
  const {
    name, brand, year, horsepower, engine, mileage, owner, location, latitude, longitude,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const uploadedFiles = [];

  try {
    const connection = await pool.getConnection();

    // Créer la voiture
    const [result] = await connection.query(
      `INSERT INTO cars
        (name, brand, year, horsepower, engine, mileage,
          owner, location, latitude, longitude, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, toStr(brand), toInt(year), toInt(horsepower),
        toStr(engine), toInt(mileage), toStr(owner),
        toStr(location), toFloat(latitude), toFloat(longitude), req.user.id],
    );

    const carId = result.insertId;

    // Upload photos to Bunny CDN with user/car directory structure
    if (req.files && req.files.length > 0) {
      for (const [idx, file] of req.files.entries()) {
        const filePath = generateFilePath(req.user.id, carId, file.originalname);
        await uploadFile(file.buffer, filePath);
        uploadedFiles.push(filePath);

        await connection.query(
          'INSERT INTO photos (car_id, filename, is_primary) VALUES (?, ?, ?)',
          [carId, filePath, idx === 0 ? 1 : 0],
        );
      }
    }

    // Récupérer la voiture avec ses photos
    const [cars] = await connection.query(
      'SELECT * FROM cars WHERE id = ?',
      [carId],
    );

    const car = await carWithPhotos(cars[0], connection);
    connection.release();

    res.status(201).json(car);
  } catch (error) {
    logger.error('Error creating car', {
      method: 'POST',
      path: '/api/cars',
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
      requestBody: req.body,
    });

    // Supprimer les fichiers uploadés sur Bunny en cas d'erreur
    if (uploadedFiles.length > 0) {
      for (const fileName of uploadedFiles) {
        await deleteFile(fileName).catch(() => {});
      }
    }

    res.status(500).json({ error: 'An error occurred while creating the car.' });
  }
});

/**
 * @swagger
 * /api/cars/{id}:
 *   put:
 *     summary: Update an existing car
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nissan Skyline GT-R
 *               brand:
 *                 type: string
 *                 example: Nissan
 *               year:
 *                 type: integer
 *                 example: 1999
 *               horsepower:
 *                 type: integer
 *                 example: 280
 *               engine:
 *                 type: string
 *                 example: RB26DETT 2.6L Twin-Turbo
 *               mileage:
 *                 type: integer
 *                 example: 50000
 *               owner:
 *                 type: string
 *                 example: John Doe
 *               location:
 *                 type: string
 *                 example: Tokyo, Japan
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 35.6895
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 139.6917
 *     responses:
 *       200:
 *         description: Car updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Car'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Car not found or not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PUT /api/cars/:id - Mettre à jour une voiture
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Vérifier que la voiture existe et appartient à l'utilisateur
    const [cars] = await connection.query(
      'SELECT * FROM cars WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );

    if (cars.length === 0) {
      return res.status(404).json({ error: 'Car not found or not authorized.' });
    }

    const {
      name, brand, year, horsepower, engine, mileage, owner, location, latitude, longitude,
    } = req.body;

    await connection.query(
      `UPDATE cars SET
        name = ?, brand = ?, year = ?, horsepower = ?, engine = ?,
        mileage = ?, owner = ?, location = ?, latitude = ?, longitude = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [name, toStr(brand), toInt(year), toInt(horsepower), toStr(engine),
        toInt(mileage), toStr(owner), toStr(location),
        toFloat(latitude), toFloat(longitude), req.params.id],
    );

    const [updatedCars] = await connection.query(
      'SELECT * FROM cars WHERE id = ?',
      [req.params.id],
    );

    const car = await carWithPhotos(updatedCars[0], connection);
    connection.release();

    res.json(car);
  } catch (error) {
    logger.error('Error updating car', {
      method: 'PUT',
      path: `/api/cars/${req.params.id}`,
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
    });
    res.status(500).json({ error: 'An error occurred while updating the car.' });
  }
});

/**
 * @swagger
 * /api/cars/{id}:
 *   delete:
 *     summary: Delete a car
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *     responses:
 *       204:
 *         description: Car deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Car not found or not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH /api/cars/:id - Mettre à jour le like
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [cars] = await connection.query(
      'SELECT * FROM cars WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );

    if (cars.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Car not found or not authorized.' });
    }

    const liked = req.body.liked === true || req.body.liked === 1;

    await connection.query(
      'UPDATE cars SET liked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [liked, req.params.id],
    );

    const [updated] = await connection.query('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    const car = await carWithPhotos(updated[0], connection);
    connection.release();

    res.json(car);
  } catch (error) {
    logger.error('Error patching car', {
      method: 'PATCH',
      path: `/api/cars/${req.params.id}`,
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
    });
    res.status(500).json({ error: 'An error occurred while updating the car.' });
  }
});

// DELETE /api/cars/:id - Supprimer une voiture
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Vérifier que la voiture existe et appartient à l'utilisateur
    const [cars] = await connection.query(
      'SELECT * FROM cars WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );

    if (cars.length === 0) {
      return res.status(404).json({ error: 'Car not found or not authorized.' });
    }

    // Supprimer les photos de Bunny CDN
    const [photos] = await connection.query(
      'SELECT filename FROM photos WHERE car_id = ?',
      [req.params.id],
    );

    for (const p of photos) {
      await deleteFile(p.filename).catch(() => {});
    }

    // Supprimer la voiture (et ses photos via CASCADE)
    await connection.query('DELETE FROM cars WHERE id = ?', [req.params.id]);

    connection.release();
    res.status(204).end();
  } catch (error) {
    logger.error('Error deleting car', {
      method: 'DELETE',
      path: `/api/cars/${req.params.id}`,
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
    });
    res.status(500).json({ error: 'An error occurred while deleting the car.' });
  }
});

/**
 * @swagger
 * /api/cars/{id}/photos:
 *   post:
 *     summary: Add photos to a car
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Photos added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Car'
 *       400:
 *         description: No photos provided
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Car not found or not authorized
 */
// POST /api/cars/:id/photos - Ajouter des photos à une voiture
router.post('/:id/photos', authenticateToken, upload.array('photos', 10), async (req, res) => {
  const uploadedFiles = [];

  try {
    const connection = await pool.getConnection();

    // Vérifier que la voiture existe et appartient à l'utilisateur
    const [cars] = await connection.query(
      'SELECT * FROM cars WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );

    if (cars.length === 0) {
      return res.status(404).json({ error: 'Car not found or not authorized.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    // Vérifier s'il y a déjà une photo principale
    const [existingPrimary] = await connection.query(
      'SELECT id FROM photos WHERE car_id = ? AND is_primary = 1',
      [req.params.id],
    );

    // Upload photos to Bunny CDN with user/car directory structure
    for (const [idx, file] of req.files.entries()) {
      const filePath = generateFilePath(req.user.id, req.params.id, file.originalname);
      await uploadFile(file.buffer, filePath);
      uploadedFiles.push(filePath);

      await connection.query(
        'INSERT INTO photos (car_id, filename, is_primary) VALUES (?, ?, ?)',
        [req.params.id, filePath, !existingPrimary.length && idx === 0 ? 1 : 0],
      );
    }

    // Récupérer la voiture avec ses photos
    const [carsWithPhotos] = await connection.query(
      'SELECT * FROM cars WHERE id = ?',
      [req.params.id],
    );

    const car = await carWithPhotos(carsWithPhotos[0], connection);
    connection.release();

    res.status(201).json(car);
  } catch (error) {
    logger.error('Error adding photos to car', {
      method: 'POST',
      path: `/api/cars/${req.params.id}/photos`,
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
      carId: req.params.id,
    });

    // Supprimer les fichiers uploadés sur Bunny en cas d'erreur
    if (uploadedFiles.length > 0) {
      for (const fileName of uploadedFiles) {
        await deleteFile(fileName).catch(() => {});
      }
    }

    res.status(500).json({ error: 'An error occurred while adding photos.' });
  }
});

/**
 * @swagger
 * /api/cars/{id}/photos/{photoId}:
 *   delete:
 *     summary: Delete a photo from a car
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Car ID
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Photo ID
 *     responses:
 *       204:
 *         description: Photo deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to delete this photo
 *       404:
 *         description: Photo not found or not authorized
 */
// DELETE /api/cars/:id/photos/:photoId - Supprimer une photo
router.delete('/:id/photos/:photoId', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Vérifier que la photo existe et appartient à une voiture de l'utilisateur
    const [photos] = await connection.query(
      `SELECT p.*, c.user_id 
       FROM photos p 
       JOIN cars c ON p.car_id = c.id 
       WHERE p.id = ? AND p.car_id = ?`,
      [req.params.photoId, req.params.id],
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: 'Photo not found or not authorized.' });
    }

    if (photos[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this resource.' });
    }

    const photo = photos[0];

    // Supprimer le fichier de Bunny CDN
    await deleteFile(photo.filename).catch(() => {});

    // Supprimer la photo de la base de données
    await connection.query('DELETE FROM photos WHERE id = ?', [req.params.photoId]);

    // Si c'était la photo principale, en définir une nouvelle
    if (photo.is_primary) {
      const [nextPhotos] = await connection.query(
        'SELECT id FROM photos WHERE car_id = ? ORDER BY created_at ASC LIMIT 1',
        [req.params.id],
      );

      if (nextPhotos.length > 0) {
        await connection.query(
          'UPDATE photos SET is_primary = 1 WHERE id = ?',
          [nextPhotos[0].id],
        );
      }
    }

    connection.release();
    res.status(204).end();
  } catch (error) {
    logger.error('Error deleting photo', {
      method: 'DELETE',
      path: `/api/cars/${req.params.id}/photos/${req.params.photoId}`,
      statusCode: 500,
      error,
      user: req.user ? { id: req.user.id } : null,
      carId: req.params.id,
      photoId: req.params.photoId,
    });
    res.status(500).json({ error: 'An error occurred while deleting the photo.' });
  }
});

module.exports = router;

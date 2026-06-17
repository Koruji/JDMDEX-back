const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
    const allowedMime = file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream';
    if (!allowedMime && !allowedExts.test(file.originalname)) {
      return cb(new Error('Only images are allowed'));
    }
    cb(null, true);
  },
});

const toInt = (v) => (v === '' || v == null) ? null : (parseInt(v) || null);
const toFloat = (v) => (v === '' || v == null) ? null : (parseFloat(v) || null);
const toStr = (v) => (v === '' || v == null) ? null : String(v);

function carWithPhotos(car) {
  const photos = db
    .prepare('SELECT * FROM photos WHERE car_id = ? ORDER BY is_primary DESC, created_at ASC')
    .all(car.id);
  return { ...car, photos };
}

// GET /api/cars
router.get('/', (req, res) => {
  const cars = db.prepare('SELECT * FROM cars ORDER BY created_at DESC').all();
  const result = cars.map(carWithPhotos);
  res.json(result);
});

// GET /api/cars/:id
router.get('/:id', (req, res) => {
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });
  res.json(carWithPhotos(car));
});

// POST /api/cars  — create with optional photo
router.post('/', upload.array('photos', 10), (req, res) => {
  const { name, brand, year, horsepower, engine, mileage, owner, location, latitude, longitude } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db
    .prepare(
      `INSERT INTO cars (name, brand, year, horsepower, engine, mileage, owner, location, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name, toStr(brand), toInt(year), toInt(horsepower),
      toStr(engine), toInt(mileage), toStr(owner),
      toStr(location), toFloat(latitude), toFloat(longitude)
    );

  const carId = result.lastInsertRowid;

  if (req.files && req.files.length > 0) {
    const insertPhoto = db.prepare(
      'INSERT INTO photos (car_id, filename, is_primary) VALUES (?, ?, ?)'
    );
    req.files.forEach((file, idx) => {
      insertPhoto.run(carId, file.filename, idx === 0 ? 1 : 0);
    });
  }

  res.status(201).json(carWithPhotos(db.prepare('SELECT * FROM cars WHERE id = ?').get(carId)));
});

// PUT /api/cars/:id
router.put('/:id', (req, res) => {
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });

  const { name, brand, year, horsepower, engine, mileage, owner, location, latitude, longitude } = req.body;

  db.prepare(
    `UPDATE cars SET
      name = ?, brand = ?, year = ?, horsepower = ?, engine = ?,
      mileage = ?, owner = ?, location = ?, latitude = ?, longitude = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(name, brand, year, horsepower, engine, mileage, owner, location, latitude, longitude, req.params.id);

  res.json(carWithPhotos(db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id)));
});

// DELETE /api/cars/:id
router.delete('/:id', (req, res) => {
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });

  const photos = db.prepare('SELECT filename FROM photos WHERE car_id = ?').all(req.params.id);
  photos.forEach((p) => {
    const filePath = path.join(__dirname, '../../uploads', p.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  db.prepare('DELETE FROM cars WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// POST /api/cars/:id/photos
router.post('/:id/photos', upload.array('photos', 10), (req, res) => {
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No photos provided' });
  }

  const existingPrimary = db
    .prepare('SELECT id FROM photos WHERE car_id = ? AND is_primary = 1')
    .get(req.params.id);

  const insertPhoto = db.prepare(
    'INSERT INTO photos (car_id, filename, is_primary) VALUES (?, ?, ?)'
  );
  req.files.forEach((file, idx) => {
    insertPhoto.run(req.params.id, file.filename, !existingPrimary && idx === 0 ? 1 : 0);
  });

  res.status(201).json(carWithPhotos(db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id)));
});

// DELETE /api/cars/:id/photos/:photoId
router.delete('/:id/photos/:photoId', (req, res) => {
  const photo = db
    .prepare('SELECT * FROM photos WHERE id = ? AND car_id = ?')
    .get(req.params.photoId, req.params.id);

  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const filePath = path.join(__dirname, '../../uploads', photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.photoId);

  if (photo.is_primary) {
    const next = db
      .prepare('SELECT id FROM photos WHERE car_id = ? ORDER BY created_at ASC LIMIT 1')
      .get(req.params.id);
    if (next) {
      db.prepare('UPDATE photos SET is_primary = 1 WHERE id = ?').run(next.id);
    }
  }

  res.status(204).end();
});

// POST /api/cars/recognize — mock AI recognition
router.post('/recognize', upload.single('photo'), (req, res) => {
  const jdmModels = [
    { brand: 'Nissan', name: 'Skyline GT-R', year: 1999, horsepower: 280, engine: 'RB26DETT 2.6L Twin-Turbo' },
    { brand: 'Toyota', name: 'Supra RZ', year: 1997, horsepower: 280, engine: '2JZ-GTE 3.0L Twin-Turbo' },
    { brand: 'Mazda', name: 'RX-7 FD', year: 1993, horsepower: 255, engine: '13B-REW Rotary Twin-Turbo' },
    { brand: 'Honda', name: 'NSX Type-R', year: 1992, horsepower: 270, engine: 'C30A 3.0L V6' },
    { brand: 'Subaru', name: 'Impreza WRX STI', year: 2001, horsepower: 280, engine: 'EJ207 2.0L Turbo' },
    { brand: 'Mitsubishi', name: 'Lancer Evolution VI', year: 1999, horsepower: 280, engine: '4G63T 2.0L Turbo' },
  ];
  const pick = jdmModels[Math.floor(Math.random() * jdmModels.length)];
  res.json({ ...pick, mileage: null, owner: null, confidence: Math.floor(70 + Math.random() * 25) });
});

module.exports = router;

const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/database');

jest.mock('../../services/bunny', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://cdn.test/car.jpg'),
  generateFilePath: jest.fn().mockReturnValue('test/cars/1/photo.jpg'),
  generateProfilePath: jest.fn().mockReturnValue('test/profile.jpg'),
  deleteFile: jest.fn().mockResolvedValue(),
}));

// Inscrit un utilisateur et retourne son token
async function registerAndLogin() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'carowner', email: 'carowner@test.com', password: 'pass123' });
  return res.body.token;
}

// ---------------------------------------------------------------------------
// POST /api/cars
// ---------------------------------------------------------------------------
describe('POST /api/cars — intégration', () => {
  test('insère réellement une voiture en base', async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nissan Skyline GT-R', brand: 'Nissan', year: '1999' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Nissan Skyline GT-R');

    // Vérification directe en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM cars WHERE id = ?', [res.body.id]);
    conn.release();

    expect(rows).toHaveLength(1);
    expect(rows[0].brand).toBe('Nissan');
    expect(rows[0].year).toBe(1999);
  });
});

// ---------------------------------------------------------------------------
// GET /api/cars
// ---------------------------------------------------------------------------
describe('GET /api/cars — intégration', () => {
  test('retourne uniquement les voitures de l\'utilisateur connecté', async () => {
    const token = await registerAndLogin();

    // Créer 2 voitures
    await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Voiture 1' });

    await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Voiture 2' });

    const res = await request(app)
      .get('/api/cars')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((c) => c.name.startsWith('Voiture'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/cars/:id
// ---------------------------------------------------------------------------
describe('PUT /api/cars/:id — intégration', () => {
  test('met à jour réellement les données en base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ancienne', brand: 'Toyota' });

    const carId = createRes.body.id;

    const res = await request(app)
      .put(`/api/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nouvelle', brand: 'Nissan', year: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nouvelle');

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM cars WHERE id = ?', [carId]);
    conn.release();

    expect(rows[0].name).toBe('Nouvelle');
    expect(rows[0].brand).toBe('Nissan');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/cars/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/cars/:id — intégration', () => {
  test('supprime réellement la voiture de la base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A supprimer' });

    const carId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Vérification en base : la voiture ne doit plus exister
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM cars WHERE id = ?', [carId]);
    conn.release();

    expect(rows).toHaveLength(0);
  });

  test('ne peut pas supprimer la voiture d\'un autre utilisateur', async () => {
    const token1 = await registerAndLogin();

    // Deuxième utilisateur
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'other', email: 'other@test.com', password: 'pass123' });
    const token2 = res2.body.token;

    // User1 crée une voiture
    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Ma voiture' });

    // User2 essaie de la supprimer
    const deleteRes = await request(app)
      .delete(`/api/cars/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(deleteRes.status).toBe(404); // 404 car la requête filtre par user_id
  });
});

// ---------------------------------------------------------------------------
// GET /api/cars/:id
// ---------------------------------------------------------------------------
describe('GET /api/cars/:id — intégration', () => {
  test('retourne la voiture avec ses photos depuis la base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Honda NSX', brand: 'Honda', year: '1992' });

    const carId = createRes.body.id;

    const res = await request(app)
      .get(`/api/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Honda NSX');
    expect(res.body).toHaveProperty('photos');
  });

  test('404 si la voiture appartient à un autre utilisateur', async () => {
    const token1 = await registerAndLogin();
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'other', email: 'other@test.com', password: 'pass123' });
    const token2 = res2.body.token;

    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Ma voiture' });

    const res = await request(app)
      .get(`/api/cars/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/cars/:id (liked)
// ---------------------------------------------------------------------------
describe('PATCH /api/cars/:id — intégration', () => {
  test('met à jour le champ liked en base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mazda RX-7' });

    const carId = createRes.body.id;

    const res = await request(app)
      .patch(`/api/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ liked: true });

    expect(res.status).toBe(200);

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT liked FROM cars WHERE id = ?', [carId]);
    conn.release();

    expect(rows[0].liked).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/cars/:id/photos
// ---------------------------------------------------------------------------
describe('POST /api/cars/:id/photos — intégration', () => {
  test('insère réellement la photo en base et la lie à la voiture', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Subaru Impreza' });

    const carId = createRes.body.id;

    const res = await request(app)
      .post(`/api/cars/${carId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photos', Buffer.from('fake-image'), 'photo.jpg');

    expect(res.status).toBe(201);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0].is_primary).toBe(1);

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM photos WHERE car_id = ?', [carId]);
    conn.release();

    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/cars/:id/photos/:photoId
// ---------------------------------------------------------------------------
describe('DELETE /api/cars/:id/photos/:photoId — intégration', () => {
  test('supprime réellement la photo de la base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mitsubishi Evo' });

    const carId = createRes.body.id;

    // Ajouter une photo
    const photoRes = await request(app)
      .post(`/api/cars/${carId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photos', Buffer.from('fake-image'), 'photo.jpg');

    const photoId = photoRes.body.photos[0].id;

    const res = await request(app)
      .delete(`/api/cars/${carId}/photos/${photoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM photos WHERE id = ?', [photoId]);
    conn.release();

    expect(rows).toHaveLength(0);
  });
});

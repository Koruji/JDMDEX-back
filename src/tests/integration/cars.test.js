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

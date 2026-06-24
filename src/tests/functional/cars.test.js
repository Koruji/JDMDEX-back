process.env.JWT_SECRET = 'testsecret';

const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/database');
const { generateToken } = require('../../middleware/auth');

jest.mock('../../db/database', () => ({ getConnection: jest.fn() }));
jest.mock('../../services/bunny', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://cdn.example.com/car.jpg'),
  deleteFile: jest.fn().mockResolvedValue(),
  generateFilePath: jest.fn().mockReturnValue('cars/1/1/photo.jpg'),
  generateProfilePath: jest.fn().mockReturnValue('users/1/profile.jpg'),
}));

const fakeCar = {
  id: 1,
  name: 'Nissan Skyline GT-R',
  brand: 'Nissan',
  year: 1999,
  user_id: 1,
};

function makeConnection(queryResults = []) {
  let callIndex = 0;
  const conn = {
    query: jest.fn().mockImplementation(() => {
      const result = queryResults[callIndex] ?? [[]];
      callIndex++;
      return Promise.resolve(result);
    }),
    release: jest.fn(),
  };
  pool.getConnection.mockResolvedValue(conn);
  return conn;
}

const token = () =>
  generateToken({ id: 1, username: 'testuser', email: 'test@example.com' });

const authHeader = () => ({ Authorization: `Bearer ${token()}` });

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/cars
// ---------------------------------------------------------------------------
describe('GET /api/cars', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(401);
  });

  test('200 retourne la liste des voitures avec leurs photos', async () => {
    makeConnection([
      [[fakeCar]],  // SELECT cars
      [[]],          // SELECT photos pour car 1
    ]);
    const res = await request(app).get('/api/cars').set(authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('name', 'Nissan Skyline GT-R');
    expect(res.body[0]).toHaveProperty('photos');
  });

  test('200 retourne un tableau vide si l\'utilisateur n\'a pas de voitures', async () => {
    makeConnection([[[]]]); // aucune voiture
    const res = await request(app).get('/api/cars').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/cars/:id
// ---------------------------------------------------------------------------
describe('GET /api/cars/:id', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/cars/1');
    expect(res.status).toBe(401);
  });

  test('404 si voiture introuvable ou pas propriétaire', async () => {
    makeConnection([[[]]]); // aucune voiture trouvée
    const res = await request(app).get('/api/cars/999').set(authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('200 avec les détails de la voiture et ses photos', async () => {
    makeConnection([
      [[fakeCar]], // SELECT car
      [[]],         // SELECT photos
    ]);
    const res = await request(app).get('/api/cars/1').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Nissan Skyline GT-R');
    expect(res.body).toHaveProperty('photos');
  });
});

// ---------------------------------------------------------------------------
// POST /api/cars
// ---------------------------------------------------------------------------
describe('POST /api/cars', () => {
  test('401 sans token', async () => {
    const res = await request(app).post('/api/cars').send({ name: 'R34' });
    expect(res.status).toBe(401);
  });

  test('400 si name manquant', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set(authHeader())
      .send({ brand: 'Nissan' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  test('201 si voiture créée sans photos', async () => {
    makeConnection([
      [{ insertId: 1 }], // INSERT car
      [[fakeCar]],        // SELECT car créée
      [[]],               // SELECT photos (carWithPhotos)
    ]);
    const res = await request(app)
      .post('/api/cars')
      .set(authHeader())
      .send({ name: 'Nissan Skyline GT-R', brand: 'Nissan', year: '1999' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'Nissan Skyline GT-R');
    expect(res.body.photos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/cars/:id
// ---------------------------------------------------------------------------
describe('PUT /api/cars/:id', () => {
  test('401 sans token', async () => {
    const res = await request(app).put('/api/cars/1').send({ name: 'Supra' });
    expect(res.status).toBe(401);
  });

  test('404 si voiture introuvable ou pas propriétaire', async () => {
    makeConnection([[[]]]); // aucune voiture
    const res = await request(app).put('/api/cars/999').set(authHeader()).send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  test('200 après mise à jour de la voiture', async () => {
    const updatedCar = { ...fakeCar, name: 'Nissan R34' };
    makeConnection([
      [[fakeCar]],       // SELECT (ownership check)
      [{ affectedRows: 1 }], // UPDATE
      [[updatedCar]],    // SELECT updated car
      [[]],              // SELECT photos (carWithPhotos)
    ]);
    const res = await request(app)
      .put('/api/cars/1')
      .set(authHeader())
      .send({ name: 'Nissan R34', brand: 'Nissan', year: 1999 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Nissan R34');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/cars/:id (mise à jour du "liked")
// ---------------------------------------------------------------------------
describe('PATCH /api/cars/:id', () => {
  test('401 sans token', async () => {
    const res = await request(app).patch('/api/cars/1').send({ liked: true });
    expect(res.status).toBe(401);
  });

  test('404 si voiture introuvable', async () => {
    makeConnection([[[]]]); // aucune voiture
    const res = await request(app).patch('/api/cars/999').set(authHeader()).send({ liked: true });
    expect(res.status).toBe(404);
  });

  test('200 après avoir mis à jour le liked', async () => {
    const likedCar = { ...fakeCar, liked: true };
    makeConnection([
      [[fakeCar]],           // SELECT (ownership check)
      [{ affectedRows: 1 }], // UPDATE liked
      [[likedCar]],          // SELECT updated car
      [[]],                   // SELECT photos (carWithPhotos)
    ]);
    const res = await request(app).patch('/api/cars/1').set(authHeader()).send({ liked: true });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('liked', true);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/cars/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/cars/:id', () => {
  test('401 sans token', async () => {
    const res = await request(app).delete('/api/cars/1');
    expect(res.status).toBe(401);
  });

  test('404 si voiture introuvable ou pas propriétaire', async () => {
    makeConnection([[[]]]); // aucune voiture
    const res = await request(app).delete('/api/cars/999').set(authHeader());
    expect(res.status).toBe(404);
  });

  test('204 après suppression réussie', async () => {
    makeConnection([
      [[fakeCar]], // SELECT car (ownership check)
      [[]],         // SELECT photos à supprimer de Bunny
      [{ affectedRows: 1 }], // DELETE car
    ]);
    const res = await request(app).delete('/api/cars/1').set(authHeader());
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// POST /api/cars/:id/photos
// ---------------------------------------------------------------------------
describe('POST /api/cars/:id/photos', () => {
  test('401 sans token', async () => {
    const res = await request(app).post('/api/cars/1/photos');
    expect(res.status).toBe(401);
  });

  test('404 si voiture introuvable', async () => {
    makeConnection([[[]]]); // aucune voiture
    const res = await request(app).post('/api/cars/999/photos').set(authHeader());
    expect(res.status).toBe(404);
  });

  test('400 si aucune photo fournie', async () => {
    makeConnection([[[fakeCar]]]); // voiture trouvée
    const res = await request(app).post('/api/cars/1/photos').set(authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no photos/i);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/cars/:id/photos/:photoId
// ---------------------------------------------------------------------------
describe('DELETE /api/cars/:id/photos/:photoId', () => {
  test('401 sans token', async () => {
    const res = await request(app).delete('/api/cars/1/photos/5');
    expect(res.status).toBe(401);
  });

  test('404 si voiture introuvable', async () => {
    makeConnection([[[]]]); // aucune voiture
    const res = await request(app).delete('/api/cars/999/photos/5').set(authHeader());
    expect(res.status).toBe(404);
  });
});

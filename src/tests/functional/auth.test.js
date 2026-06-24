process.env.JWT_SECRET = 'testsecret';

const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/database');
const { generateToken } = require('../../middleware/auth');

jest.mock('../../db/database', () => ({ getConnection: jest.fn() }));
jest.mock('../../services/bunny', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://cdn.example.com/img.jpg'),
  generateProfilePath: jest.fn().mockReturnValue('users/1/profile.jpg'),
  deleteFile: jest.fn().mockResolvedValue(),
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

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

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  test('400 si champs manquants', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'foo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 si email invalide', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'foo', email: 'pas-un-email', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  test('400 si mot de passe trop court', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'foo', email: 'foo@example.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  test('409 si username ou email déjà pris', async () => {
    makeConnection([
      [[{ id: 1 }]], // utilisateur existant trouvé
    ]);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'existe', email: 'existe@example.com', password: 'pass123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('201 avec token si inscription réussie', async () => {
    makeConnection([
      [[]], // aucun utilisateur existant
      [{ insertId: 42 }], // INSERT users
      [[{ id: 42, username: 'newuser', email: 'new@example.com', profil_img_url: null }]], // SELECT user
    ]);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', email: 'new@example.com', password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('id', 42);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  test('400 si champs manquants', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'foo' });
    expect(res.status).toBe(400);
  });

  test('401 si utilisateur introuvable', async () => {
    makeConnection([[[]]]);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'inconnu', password: 'pass123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('401 si mauvais mot de passe', async () => {
    const bcrypt = require('bcrypt');
    bcrypt.compare.mockResolvedValueOnce(false);
    makeConnection([
      [[{ id: 1, username: 'foo', email: 'foo@example.com', password_hash: 'hash' }]],
    ]);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'foo', password: 'mauvais' });
    expect(res.status).toBe(401);
  });

  test('200 avec token si login réussi', async () => {
    makeConnection([
      [[{ id: 1, username: 'foo', email: 'foo@example.com', password_hash: 'hash' }]],
    ]);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'foo', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('username', 'foo');
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
describe('GET /api/auth/me', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('403 avec token invalide', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer tokenbidon');
    expect(res.status).toBe(403);
  });

  test('200 avec les infos utilisateur si token valide', async () => {
    const token = generateToken({ id: 1, username: 'foo', email: 'foo@example.com' });
    makeConnection([
      [[{ id: 1, username: 'foo', email: 'foo@example.com' }]],
    ]);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('username', 'foo');
  });
});

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

const validToken = () =>
  generateToken({ id: 1, username: 'testuser', email: 'test@example.com' });

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/users/me
// ---------------------------------------------------------------------------
describe('GET /api/users/me', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  test('200 avec le profil complet de l\'utilisateur connecté', async () => {
    const user = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      social_media: '@testuser',
      profil_img_url: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };
    makeConnection([[[user]]]);
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'testuser');
    expect(res.body).toHaveProperty('email', 'test@example.com');
  });

  test('404 si utilisateur non trouvé en base', async () => {
    makeConnection([[[]]]); // aucun résultat
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/users/me
// ---------------------------------------------------------------------------
describe('PUT /api/users/me', () => {
  test('401 sans token', async () => {
    const res = await request(app).put('/api/users/me').send({ username: 'nouveau' });
    expect(res.status).toBe(401);
  });

  test('200 après mise à jour du profil', async () => {
    const updatedUser = {
      id: 1,
      username: 'nouveau',
      email: 'test@example.com',
      social_media: null,
      profil_img_url: null,
    };
    makeConnection([
      [[]], // pas de conflit username/email
      [{ affectedRows: 1 }], // UPDATE
      [[updatedUser]], // SELECT après update
    ]);
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ username: 'nouveau' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'nouveau');
  });

  test('409 si le username est déjà pris par quelqu\'un d\'autre', async () => {
    makeConnection([
      [[{ id: 99 }]], // conflit : un autre user a ce username
    ]);
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ username: 'pris' });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------
describe('GET /api/users/:id', () => {
  test('200 avec profil public d\'un utilisateur', async () => {
    const publicProfile = {
      id: 2,
      username: 'autre',
      social_media: null,
      profil_img_url: null,
      created_at: '2024-01-01',
    };
    makeConnection([[[publicProfile]]]);
    const res = await request(app).get('/api/users/2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'autre');
  });

  test('404 si utilisateur introuvable', async () => {
    makeConnection([[[]]]); // aucun résultat
    const res = await request(app).get('/api/users/999');
    expect(res.status).toBe(404);
  });
});

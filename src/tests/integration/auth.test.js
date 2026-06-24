const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/database');

jest.mock('../../services/bunny', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://cdn.test/img.jpg'),
  generateProfilePath: jest.fn().mockReturnValue('test/profile.jpg'),
  deleteFile: jest.fn().mockResolvedValue(),
}));

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
describe('POST /api/auth/register — intégration', () => {
  test('insère réellement un utilisateur en base', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: 'pass123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');

    // Vérification directe en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM users WHERE email = ?', ['test@test.com']);
    conn.release();

    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('testuser');
    expect(rows[0].password_hash).not.toBe('pass123'); // doit être haché
  });

  test('409 si le même email est déjà enregistré', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'user1', email: 'dupe@test.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user2', email: 'dupe@test.com', password: 'pass123' });

    expect(res.status).toBe(409);
  });

  test('409 si le même username est déjà pris', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'samename', email: 'first@test.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'samename', email: 'second@test.com', password: 'pass123' });

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login — intégration', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'loginuser', email: 'login@test.com', password: 'pass123' });
  });

  test('retourne un token JWT valide avec les bonnes credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('username', 'loginuser');
  });

  test('401 avec un mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'mauvais' });

    expect(res.status).toBe(401);
  });

  test('fonctionne aussi avec l\'email à la place du username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'login@test.com', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
describe('GET /api/auth/me — intégration', () => {
  test('retourne les données de l\'utilisateur connecté depuis la base', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'meuser', email: 'me@test.com', password: 'pass123' });

    const { token } = registerRes.body;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('username', 'meuser');
    expect(res.body.user).toHaveProperty('email', 'me@test.com');
    expect(res.body.user).not.toHaveProperty('password_hash'); // jamais exposé
  });
});

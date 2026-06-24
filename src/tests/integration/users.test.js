const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/database');

jest.mock('../../services/bunny', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://cdn.test/img.jpg'),
  generateProfilePath: jest.fn().mockReturnValue('test/profile.jpg'),
  deleteFile: jest.fn().mockResolvedValue(),
}));

async function registerAndLogin(username = 'testuser', email = 'test@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password: 'pass123' });
  return res.body;
}

// ---------------------------------------------------------------------------
// GET /api/users/me
// ---------------------------------------------------------------------------
describe('GET /api/users/me — intégration', () => {
  test('retourne le profil complet depuis la base', async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'testuser');
    expect(res.body).toHaveProperty('email', 'test@test.com');
    expect(res.body).toHaveProperty('created_at');
    expect(res.body).not.toHaveProperty('password_hash');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/users/me
// ---------------------------------------------------------------------------
describe('PUT /api/users/me — intégration', () => {
  test('met à jour réellement le username en base', async () => {
    const { token, user } = await registerAndLogin();

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'nouveaunom' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('nouveaunom');

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT username FROM users WHERE id = ?', [user.id]);
    conn.release();

    expect(rows[0].username).toBe('nouveaunom');
  });

  test('met à jour le social_media en base', async () => {
    const { token, user } = await registerAndLogin();

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'testuser', social_media: '@jdmfan' });

    expect(res.status).toBe(200);

    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT social_media FROM users WHERE id = ?', [user.id]);
    conn.release();

    expect(rows[0].social_media).toBe('@jdmfan');
  });

  test('409 si le nouveau username est déjà pris par quelqu\'un d\'autre', async () => {
    await registerAndLogin('user1', 'user1@test.com');
    const { token } = await registerAndLogin('user2', 'user2@test.com');

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'user1' }); // déjà pris

    expect(res.status).toBe(409);
  });

  test('409 si le nouvel email est déjà pris par quelqu\'un d\'autre', async () => {
    await registerAndLogin('user1', 'user1@test.com');
    const { token } = await registerAndLogin('user2', 'user2@test.com');

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'user2', email: 'user1@test.com' }); // déjà pris

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------
describe('GET /api/users/:id — intégration', () => {
  test('retourne le profil public d\'un utilisateur', async () => {
    const { user } = await registerAndLogin();

    const res = await request(app).get(`/api/users/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'testuser');
    expect(res.body).not.toHaveProperty('email');        // non exposé
    expect(res.body).not.toHaveProperty('password_hash'); // non exposé
  });

  test('404 si l\'utilisateur n\'existe pas', async () => {
    const res = await request(app).get('/api/users/99999');
    expect(res.status).toBe(404);
  });
});

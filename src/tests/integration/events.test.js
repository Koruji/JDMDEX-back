const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/database');

jest.mock('../../services/bunny', () => ({
  uploadFile: jest.fn(),
  generateProfilePath: jest.fn(),
  deleteFile: jest.fn(),
}));

async function registerAndLogin() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'eventuser', email: 'event@test.com', password: 'pass123' });
  return res.body.token;
}

const baseEvent = {
  name: 'JDM Meet Paris',
  dateStart: '2024-06-01T10:00:00',
  dateEnd: '2024-06-01T18:00:00',
  type: 'rasso',
};

// ---------------------------------------------------------------------------
// POST /api/events
// ---------------------------------------------------------------------------
describe('POST /api/events — intégration', () => {
  test('insère réellement un événement en base', async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('JDM Meet Paris');

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM events WHERE id = ?', [res.body.id]);
    conn.release();

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('rasso');
  });
});

// ---------------------------------------------------------------------------
// GET /api/events
// ---------------------------------------------------------------------------
describe('GET /api/events — intégration', () => {
  test('retourne uniquement les événements de l\'utilisateur connecté', async () => {
    const token = await registerAndLogin();

    await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...baseEvent, name: 'Event 1' });

    await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...baseEvent, name: 'Event 2', type: 'expo' });

    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/events/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/events/:id — intégration', () => {
  test('supprime réellement l\'événement et ses commentaires en cascade', async () => {
    const token = await registerAndLogin();

    // Créer un événement
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    const eventId = createRes.body.id;

    // Ajouter un commentaire
    await request(app)
      .post(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Top event !' });

    // Supprimer l'événement
    const deleteRes = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(204);

    // Vérifier que l'événement ET le commentaire ont été supprimés
    const conn = await pool.getConnection();
    const [events] = await conn.query('SELECT * FROM events WHERE id = ?', [eventId]);
    const [comments] = await conn.query('SELECT * FROM event_comments WHERE event_id = ?', [eventId]);
    conn.release();

    expect(events).toHaveLength(0);
    expect(comments).toHaveLength(0); // supprimé par CASCADE
  });
});

// ---------------------------------------------------------------------------
// POST /api/events/:id/comments
// ---------------------------------------------------------------------------
describe('POST /api/events/:id/comments — intégration', () => {
  test('insère réellement un commentaire et le lie à l\'événement', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    const eventId = createRes.body.id;

    const res = await request(app)
      .post(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Super meet, j\'y serai !' });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe('Super meet, j\'y serai !');

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT * FROM event_comments WHERE event_id = ?',
      [eventId],
    );
    conn.release();

    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('Super meet, j\'y serai !');
  });
});

// ---------------------------------------------------------------------------
// GET /api/events/:id
// ---------------------------------------------------------------------------
describe('GET /api/events/:id — intégration', () => {
  test('retourne l\'événement avec ses commentaires', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    const eventId = createRes.body.id;

    await request(app)
      .post(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Hâte d\'y être !' });

    const res = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('JDM Meet Paris');
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].text).toBe('Hâte d\'y être !');
  });

  test('403 si l\'événement appartient à quelqu\'un d\'autre', async () => {
    const token1 = await registerAndLogin();
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'other', email: 'other@test.com', password: 'pass123' });
    const token2 = res2.body.token;

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token1}`)
      .send(baseEvent);

    const res = await request(app)
      .get(`/api/events/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/events/:id
// ---------------------------------------------------------------------------
describe('PUT /api/events/:id — intégration', () => {
  test('met à jour réellement l\'événement en base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    const eventId = createRes.body.id;

    const res = await request(app)
      .put(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'JDM Meet Lyon', type: 'expo' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('JDM Meet Lyon');

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT name, type FROM events WHERE id = ?', [eventId]);
    conn.release();

    expect(rows[0].name).toBe('JDM Meet Lyon');
    expect(rows[0].type).toBe('expo');
  });
});

// ---------------------------------------------------------------------------
// GET /api/events/:id/comments
// ---------------------------------------------------------------------------
describe('GET /api/events/:id/comments — intégration', () => {
  test('retourne les commentaires depuis la base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    const eventId = createRes.body.id;

    await request(app)
      .post(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Premier commentaire' });

    await request(app)
      .post(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Deuxième commentaire' });

    const res = await request(app)
      .get(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/events/:id/comments/:commentId
// ---------------------------------------------------------------------------
describe('PUT /api/events/:id/comments/:commentId — intégration', () => {
  test('met à jour réellement le texte du commentaire en base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    const eventId = createRes.body.id;

    const commentRes = await request(app)
      .post(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Texte original' });

    const commentId = commentRes.body.id;

    const res = await request(app)
      .put(`/api/events/${eventId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Texte modifié' });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Texte modifié');

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT text FROM event_comments WHERE id = ?', [commentId]);
    conn.release();

    expect(rows[0].text).toBe('Texte modifié');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/events/:id/comments/:commentId
// ---------------------------------------------------------------------------
describe('DELETE /api/events/:id/comments/:commentId — intégration', () => {
  test('supprime réellement le commentaire de la base', async () => {
    const token = await registerAndLogin();

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send(baseEvent);

    const eventId = createRes.body.id;

    const commentRes = await request(app)
      .post(`/api/events/${eventId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'À supprimer' });

    const commentId = commentRes.body.id;

    const res = await request(app)
      .delete(`/api/events/${eventId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Vérification en base
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM event_comments WHERE id = ?', [commentId]);
    conn.release();

    expect(rows).toHaveLength(0);
  });
});

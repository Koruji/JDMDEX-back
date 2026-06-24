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

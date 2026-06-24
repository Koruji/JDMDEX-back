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

const token = () =>
  generateToken({ id: 1, username: 'testuser', email: 'test@example.com' });

const authHeader = () => ({ Authorization: `Bearer ${token()}` });

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/events
// ---------------------------------------------------------------------------
describe('GET /api/events', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  test('200 retourne la liste des événements de l\'utilisateur', async () => {
    const fakeEvent = {
      id: 'uuid-1',
      name: 'JDM Meet',
      date_start: '2024-06-01',
      date_end: '2024-06-02',
      type: 'rasso',
      comments_count: 2,
    };
    makeConnection([[[fakeEvent]]]);
    const res = await request(app).get('/api/events').set(authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('name', 'JDM Meet');
  });
});

// ---------------------------------------------------------------------------
// POST /api/events
// ---------------------------------------------------------------------------
describe('POST /api/events', () => {
  test('401 sans token', async () => {
    const res = await request(app).post('/api/events').send({ name: 'test' });
    expect(res.status).toBe(401);
  });

  test('400 si champs requis manquants', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader())
      .send({ name: 'JDM Meet' }); // manque dateStart, dateEnd, type
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 si type invalide', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader())
      .send({ name: 'test', dateStart: '2024-06-01', dateEnd: '2024-06-02', type: 'mauvais' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type must be/i);
  });

  test('201 si événement créé avec succès', async () => {
    const created = {
      id: 'uuid-1',
      name: 'JDM Expo',
      dateStart: '2024-06-01',
      dateEnd: '2024-06-02',
      type: 'expo',
      user_id: 1,
    };
    makeConnection([
      [{ affectedRows: 1 }], // INSERT
      [[created]],           // SELECT après insert
    ]);
    const res = await request(app)
      .post('/api/events')
      .set(authHeader())
      .send({ name: 'JDM Expo', dateStart: '2024-06-01', dateEnd: '2024-06-02', type: 'expo' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'JDM Expo');
  });
});

// ---------------------------------------------------------------------------
// GET /api/events/:id
// ---------------------------------------------------------------------------
describe('GET /api/events/:id', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/events/uuid-1');
    expect(res.status).toBe(401);
  });

  test('404 si événement introuvable', async () => {
    makeConnection([[[]]]); // aucun événement trouvé
    const res = await request(app).get('/api/events/uuid-999').set(authHeader());
    expect(res.status).toBe(404);
  });

  test('403 si l\'événement appartient à quelqu\'un d\'autre', async () => {
    makeConnection([
      [[{ id: 'uuid-1', user_id: 99, name: 'Pas le mien' }]], // user_id ≠ 1
    ]);
    const res = await request(app).get('/api/events/uuid-1').set(authHeader());
    expect(res.status).toBe(403);
  });

  test('200 avec les commentaires si l\'utilisateur est propriétaire', async () => {
    makeConnection([
      [[{ id: 'uuid-1', user_id: 1, name: 'Mon Event', type: 'rasso' }]], // SELECT event
      [[]], // SELECT comments (vide)
    ]);
    const res = await request(app).get('/api/events/uuid-1').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Mon Event');
    expect(res.body.comments).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/events/:id
// ---------------------------------------------------------------------------
describe('PUT /api/events/:id', () => {
  test('401 sans token', async () => {
    const res = await request(app).put('/api/events/uuid-1').send({ name: 'new' });
    expect(res.status).toBe(401);
  });

  test('404 si événement introuvable', async () => {
    makeConnection([[[]]]); // aucun événement
    const res = await request(app).put('/api/events/uuid-999').set(authHeader()).send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  test('403 si l\'utilisateur ne possède pas l\'événement', async () => {
    makeConnection([[[{ id: 'uuid-1', user_id: 99 }]]]);
    const res = await request(app).put('/api/events/uuid-1').set(authHeader()).send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  test('200 après mise à jour réussie', async () => {
    makeConnection([
      [[{ id: 'uuid-1', user_id: 1 }]],                           // SELECT event
      [{ affectedRows: 1 }],                                        // UPDATE
      [[{ id: 'uuid-1', name: 'Updated', type: 'rasso' }]],       // SELECT mis à jour
    ]);
    const res = await request(app)
      .put('/api/events/uuid-1')
      .set(authHeader())
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Updated');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/events/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/events/:id', () => {
  test('401 sans token', async () => {
    const res = await request(app).delete('/api/events/uuid-1');
    expect(res.status).toBe(401);
  });

  test('404 si événement introuvable', async () => {
    makeConnection([[[]]]); // aucun événement
    const res = await request(app).delete('/api/events/uuid-999').set(authHeader());
    expect(res.status).toBe(404);
  });

  test('403 si l\'utilisateur ne possède pas l\'événement', async () => {
    makeConnection([[[{ id: 'uuid-1', user_id: 99 }]]]);
    const res = await request(app).delete('/api/events/uuid-1').set(authHeader());
    expect(res.status).toBe(403);
  });

  test('204 après suppression réussie', async () => {
    makeConnection([
      [[{ id: 'uuid-1', user_id: 1 }]], // SELECT event
      [{ affectedRows: 1 }],             // DELETE
    ]);
    const res = await request(app).delete('/api/events/uuid-1').set(authHeader());
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// GET /api/events/:id/comments
// ---------------------------------------------------------------------------
describe('GET /api/events/:id/comments', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/events/uuid-1/comments');
    expect(res.status).toBe(401);
  });

  test('404 si événement introuvable', async () => {
    makeConnection([[[]]]); // aucun événement
    const res = await request(app).get('/api/events/uuid-999/comments').set(authHeader());
    expect(res.status).toBe(404);
  });

  test('200 retourne la liste des commentaires', async () => {
    const comment = { id: 'c1', event_id: 'uuid-1', user_id: 1, text: 'Super meet!', created_at: '2024-06-01', username: 'testuser', profil_img_url: null };
    makeConnection([
      [[{ id: 'uuid-1', user_id: 1 }]],  // SELECT event
      [[comment]],                          // SELECT comments
    ]);
    const res = await request(app).get('/api/events/uuid-1/comments').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('text', 'Super meet!');
  });
});

// ---------------------------------------------------------------------------
// POST /api/events/:id/comments
// ---------------------------------------------------------------------------
describe('POST /api/events/:id/comments', () => {
  test('401 sans token', async () => {
    const res = await request(app).post('/api/events/uuid-1/comments').send({ text: 'yo' });
    expect(res.status).toBe(401);
  });

  test('400 si text manquant', async () => {
    const res = await request(app)
      .post('/api/events/uuid-1/comments')
      .set(authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  test('404 si événement introuvable', async () => {
    makeConnection([[[]]]); // aucun événement
    const res = await request(app)
      .post('/api/events/uuid-999/comments')
      .set(authHeader())
      .send({ text: 'hello' });
    expect(res.status).toBe(404);
  });

  test('201 si commentaire créé avec succès', async () => {
    const newComment = {
      id: 'c-new',
      event_id: 'uuid-1',
      user_id: 1,
      text: 'Top event!',
      created_at: '2024-06-01',
      username: 'testuser',
      profil_img_url: null,
    };
    makeConnection([
      [[{ id: 'uuid-1' }]],   // SELECT event (existe)
      [{ insertId: 'c-new' }], // INSERT comment
      [[newComment]],           // SELECT comment créé
    ]);
    const res = await request(app)
      .post('/api/events/uuid-1/comments')
      .set(authHeader())
      .send({ text: 'Top event!' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('text', 'Top event!');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/events/:id/comments/:commentId
// ---------------------------------------------------------------------------
describe('PUT /api/events/:id/comments/:commentId', () => {
  test('401 sans token', async () => {
    const res = await request(app)
      .put('/api/events/uuid-1/comments/c1')
      .send({ text: 'modifié' });
    expect(res.status).toBe(401);
  });

  test('400 si text manquant', async () => {
    const res = await request(app)
      .put('/api/events/uuid-1/comments/c1')
      .set(authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  test('404 si commentaire introuvable', async () => {
    makeConnection([[[]]]); // aucun commentaire
    const res = await request(app)
      .put('/api/events/uuid-1/comments/c999')
      .set(authHeader())
      .send({ text: 'modifié' });
    expect(res.status).toBe(404);
  });

  test('403 si le commentaire appartient à quelqu\'un d\'autre', async () => {
    makeConnection([[[{ id: 'c1', user_id: 99 }]]]);
    const res = await request(app)
      .put('/api/events/uuid-1/comments/c1')
      .set(authHeader())
      .send({ text: 'modifié' });
    expect(res.status).toBe(403);
  });

  test('200 après mise à jour du commentaire', async () => {
    const updatedComment = {
      id: 'c1', event_id: 'uuid-1', user_id: 1,
      text: 'modifié', created_at: '2024-06-01',
      username: 'testuser', profil_img_url: null,
    };
    makeConnection([
      [[{ id: 'c1', user_id: 1 }]], // SELECT comment (ownership)
      [{ affectedRows: 1 }],         // UPDATE
      [[updatedComment]],             // SELECT mis à jour
    ]);
    const res = await request(app)
      .put('/api/events/uuid-1/comments/c1')
      .set(authHeader())
      .send({ text: 'modifié' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('text', 'modifié');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/events/:id/comments/:commentId
// ---------------------------------------------------------------------------
describe('DELETE /api/events/:id/comments/:commentId', () => {
  test('401 sans token', async () => {
    const res = await request(app).delete('/api/events/uuid-1/comments/c1');
    expect(res.status).toBe(401);
  });

  test('404 si commentaire introuvable', async () => {
    makeConnection([[[]]]); // aucun commentaire
    const res = await request(app)
      .delete('/api/events/uuid-1/comments/c999')
      .set(authHeader());
    expect(res.status).toBe(404);
  });

  test('403 si le commentaire appartient à quelqu\'un d\'autre', async () => {
    makeConnection([[[{ id: 'c1', user_id: 99 }]]]);
    const res = await request(app)
      .delete('/api/events/uuid-1/comments/c1')
      .set(authHeader());
    expect(res.status).toBe(403);
  });

  test('204 après suppression réussie', async () => {
    makeConnection([
      [[{ id: 'c1', user_id: 1 }]], // SELECT comment
      [{ affectedRows: 1 }],         // DELETE
    ]);
    const res = await request(app)
      .delete('/api/events/uuid-1/comments/c1')
      .set(authHeader());
    expect(res.status).toBe(204);
  });
});

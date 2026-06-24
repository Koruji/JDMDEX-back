process.env.JWT_SECRET = 'testsecret';

const request = require('supertest');
const express = require('express');
const app = require('../../app');
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

jest.mock('../../db/database', () => ({ getConnection: jest.fn() }));
jest.mock('../../services/bunny', () => ({
  uploadFile: jest.fn(),
  generateProfilePath: jest.fn(),
  deleteFile: jest.fn(),
}));

// ---------------------------------------------------------------------------
// notFoundHandler — route inconnue
// ---------------------------------------------------------------------------
describe('notFoundHandler', () => {
  test('404 sur une route qui n\'existe pas', async () => {
    const res = await request(app).get('/api/route-qui-nexiste-pas');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Route not found');
  });

  test('404 sur une méthode non définie', async () => {
    const res = await request(app).patch('/api/auth/login');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// errorHandler — middleware de gestion d'erreurs non catchées
// ---------------------------------------------------------------------------
describe('errorHandler', () => {
  test('retourne le message d\'erreur avec le bon status code', () => {
    const err = { message: 'Erreur test', statusCode: 422 };
    const req = { method: 'GET', originalUrl: '/test', body: {}, user: null };
    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erreur test' });
  });

  test('utilise 500 si pas de statusCode sur l\'erreur', () => {
    const err = new Error('crash inattendu');
    const req = { method: 'POST', originalUrl: '/test', body: {}, user: { id: 1, username: 'x' } };
    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('appelle next si les headers ont déjà été envoyés', () => {
    const err = new Error('trop tard');
    const req = {};
    const res = { headersSent: true };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

const { authenticateToken, generateToken, checkOwnership } = require('../../middleware/auth');

describe('Token generation and authentication', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'testsecret';
    });

    test('should generate a valid token for a user', () => {
        const user = { id: 1, username: 'testuser', email: 'test@mail.com' };
        const token = generateToken(user);
        expect(typeof token).toBe('string');
    });

    test('should authenticate a valid token', () => {
    const user = { id: 1, username: 'testuser', email: 'test@mail.com' };
    const token = generateToken(user);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toHaveProperty('id', 1);
});

test('should reject an invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalidtoken' } };
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
});
})

describe('Ownership check', () => {
    test('should allow access if user owns the resource', () => {
        const req = { user: { id: 1 } };
        const res = {};
        const next = jest.fn();

        const middleware = checkOwnership(1);
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    test('should deny access if user does not own the resource', () => {
        const req = { user: { id: 1 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        const middleware = checkOwnership(2);
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('should deny access if user is not authenticated', () => {
        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        const middleware = checkOwnership(1);
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });
});
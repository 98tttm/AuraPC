/**
 * Tests for auth middleware (JWT sign/verify).
 * Run: npm test
 */
const jwt = require('jsonwebtoken');

// Set test secret
process.env.JWT_SECRET = 'test-secret-for-unit-tests';
const { signToken, requireAuth, optionalAuth, requireUserOrAdmin } = require('../middleware/auth');

describe('signToken', () => {
    it('should generate a valid JWT token', () => {
        const token = signToken({ userId: 'user123', phoneNumber: '84901234567' });
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.userId).toBe('user123');
        expect(decoded.phoneNumber).toBe('84901234567');
    });

    it('should set 7d expiry by default', () => {
        const token = signToken({ userId: 'user123', phoneNumber: '84901234567' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // exp should be ~7 days from now
        const sevenDaysInSeconds = 7 * 24 * 60 * 60;
        const now = Math.floor(Date.now() / 1000);
        expect(decoded.exp - now).toBeGreaterThan(sevenDaysInSeconds - 60);
        expect(decoded.exp - now).toBeLessThanOrEqual(sevenDaysInSeconds);
    });
});

describe('requireAuth middleware', () => {
    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };
    const mockNext = jest.fn();

    beforeEach(() => {
        mockNext.mockClear();
    });

    it('should reject requests without Authorization header', () => {
        const req = { headers: {} };
        const res = mockRes();
        requireAuth(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid token', () => {
        const req = { headers: { authorization: 'Bearer invalid-token' } };
        const res = mockRes();
        requireAuth(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid JWT and set req.userId', () => {
        const token = signToken({ userId: 'user456', phoneNumber: '84999888777' });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        requireAuth(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(req.userId).toBe('user456');
        expect(req.phoneNumber).toBe('84999888777');
    });
});

describe('optionalAuth middleware', () => {
    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };
    const mockNext = jest.fn();

    beforeEach(() => {
        mockNext.mockClear();
    });

    it('should proceed without userId when no token', () => {
        const req = { headers: {} };
        const res = mockRes();
        optionalAuth(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(req.userId).toBeUndefined();
    });

    it('should set userId when valid token is provided', () => {
        const token = signToken({ userId: 'user789', phoneNumber: '84111222333' });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        optionalAuth(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(req.userId).toBe('user789');
    });

    it('should proceed without userId when invalid token', () => {
        const req = { headers: { authorization: 'Bearer garbage' } };
        const res = mockRes();
        optionalAuth(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(req.userId).toBeUndefined();
    });
});

describe('requireUserOrAdmin middleware', () => {
    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };
    const mockNext = jest.fn();

    beforeEach(() => {
        mockNext.mockClear();
    });

    it('should accept valid user JWT and set req.userId', () => {
        const token = signToken({ userId: 'user999', phoneNumber: '84999888777' });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        requireUserOrAdmin(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(req.userId).toBe('user999');
        expect(req.adminId).toBeUndefined();
    });

    it('should accept valid admin JWT and set req.adminId', () => {
        const token = signToken({ adminId: 'admin123', isAdmin: true });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        requireUserOrAdmin(req, res, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(req.adminId).toBe('admin123');
        expect(req.userId).toBeUndefined();
    });

    it('should reject requests without a valid user or admin token', () => {
        const req = { headers: {} };
        const res = mockRes();
        requireUserOrAdmin(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });
});

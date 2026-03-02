const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aurapc-default-secret-change-me';

/**
 * Ký JWT token cho user.
 * @param {{ userId: string, phoneNumber: string }} payload
 * @returns {string} signed JWT
 */
function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Extract & verify JWT từ Authorization header.
 * Trả về decoded payload hoặc null.
 */
function verifyToken(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
        return null;
    }
}

/**
 * Middleware: BẮT BUỘC đăng nhập.
 * Nếu không có token hoặc token không hợp lệ → 401.
 */
function requireAuth(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded || !decoded.userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized — token missing or invalid' });
    }
    req.userId = decoded.userId;
    req.phoneNumber = decoded.phoneNumber;
    next();
}

/**
 * Middleware: TUỲ CHỌN đăng nhập.
 * Có token → gắn req.userId; không có → bỏ qua (req.userId = undefined).
 */
function optionalAuth(req, res, next) {
    const decoded = verifyToken(req);
    if (decoded && decoded.userId) {
        req.userId = decoded.userId;
        req.phoneNumber = decoded.phoneNumber;
    }
    next();
}

/**
 * Middleware: BẮT BUỘC admin.
 * Verify JWT với isAdmin claim, tìm Admin theo adminId.
 */
function requireAdmin(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded || !decoded.isAdmin || !decoded.adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized — admin access required' });
    }
    req.adminId = decoded.adminId;
    next();
}

module.exports = { signToken, requireAuth, optionalAuth, requireAdmin };

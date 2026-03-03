const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
        return null;
    }
}

function requireAuth(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded || !decoded.userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized - token missing or invalid' });
    }
    req.userId = decoded.userId;
    req.phoneNumber = decoded.phoneNumber;
    next();
}

function optionalAuth(req, res, next) {
    const decoded = verifyToken(req);
    if (decoded && decoded.userId) {
        req.userId = decoded.userId;
        req.phoneNumber = decoded.phoneNumber;
    }
    next();
}

function requireAdmin(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded || !decoded.isAdmin || !decoded.adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized - admin access required' });
    }
    req.adminId = decoded.adminId;
    next();
}

function requireUserOrAdmin(req, res, next) {
    const decoded = verifyToken(req);
    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Unauthorized - token missing or invalid' });
    }
    if (decoded.isAdmin && decoded.adminId) {
        req.adminId = decoded.adminId;
        req.isAdmin = true;
        return next();
    }
    if (decoded.userId) {
        req.userId = decoded.userId;
        req.phoneNumber = decoded.phoneNumber;
        req.isAdmin = false;
        return next();
    }
    return res.status(401).json({ success: false, message: 'Unauthorized - token missing or invalid' });
}

module.exports = { signToken, verifyToken, requireAuth, optionalAuth, requireAdmin, requireUserOrAdmin };

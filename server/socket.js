/**
 * Socket.IO realtime: order updates sync to client (user) and admin.
 * - User token -> join room user:${userId}
 * - Admin token -> join room admin
 * - emitOrderUpdated() sends to both admin and affected user.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
let io = null;

/**
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  const allowedOrigins = [
    'https://aura-pc-client.vercel.app',
    'https://aura-pc-admin.vercel.app',
    'https://aurapc-admin.vercel.app',
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:3000',
  ];
  if (process.env.FRONTEND_URL) {
    try {
      const u = new URL(process.env.FRONTEND_URL);
      if (!allowedOrigins.includes(u.origin)) allowedOrigins.push(u.origin);
    } catch (_) {}
  }
  if (process.env.ADMIN_URL) {
    try {
      const u = new URL(process.env.ADMIN_URL);
      if (!allowedOrigins.includes(u.origin)) allowedOrigins.push(u.origin);
    } catch (_) {}
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        if (origin.endsWith('.vercel.app')) return cb(null, true);
        return cb(null, false);
      },
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || !JWT_SECRET) {
      socket.disconnect(true);
      return;
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.userId) {
        socket.join(`user:${decoded.userId}`);
        return;
      }
      if (decoded.isAdmin && decoded.adminId) {
        socket.join('admin');
        return;
      }
    } catch (err) {
      logger.debug({ err: err.message }, 'Socket auth failed');
    }
    socket.disconnect(true);
  });

  logger.info('Socket.IO server attached');
  return io;
}

/**
 * Emit order updated to admin room and to the order's user (if any).
 * @param {{ orderNumber: string, status?: string, userId?: string }} payload
 */
function emitOrderUpdated(payload) {
  if (!io) return;
  const { orderNumber, status, userId } = payload;
  const data = { orderNumber, status, userId };
  io.to('admin').emit('order:updated', data);
  if (userId) {
    io.to(`user:${userId}`).emit('order:updated', data);
  }
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO, emitOrderUpdated };

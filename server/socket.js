/**
 * Socket.IO realtime:
 * - order updates sync to client (user) and admin
 * - support chat syncs between customer and admin
 * Rooms:
 * - User token -> join room user:${userId}
 * - Admin token -> join room admin
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

        // Admin typing → relay to customer
        socket.on('support:typing', (data) => {
          if (data?.userId && data?.conversationId) {
            io.to(`user:${data.userId}`).emit('support:typing', {
              conversationId: data.conversationId,
              adminName: data.adminName || '',
            });
          }
        });

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

function resolveSupportUserId(conversation) {
  const user = conversation?.user;
  if (!user) return '';
  if (typeof user === 'string') return user;
  return String(user._id || '');
}

function emitSupportConversationUpdated(conversation) {
  if (!io || !conversation) return;
  const userId = resolveSupportUserId(conversation);
  io.to('admin').emit('support:conversation:updated', conversation);
  if (userId) {
    io.to(`user:${userId}`).emit('support:conversation:updated', conversation);
  }
}

function emitSupportMessageCreated(payload) {
  if (!io || !payload?.conversation || !payload?.message) return;
  const userId = resolveSupportUserId(payload.conversation);
  io.to('admin').emit('support:message:created', payload);
  if (userId) {
    io.to(`user:${userId}`).emit('support:message:created', payload);
  }
}

function getIO() {
  return io;
}

module.exports = {
  initSocket,
  getIO,
  emitOrderUpdated,
  emitSupportConversationUpdated,
  emitSupportMessageCreated,
};

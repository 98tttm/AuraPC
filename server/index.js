require('dotenv').config();
// Ép DNS ưu tiên IPv4 (tránh ENETUNREACH khi Render kết nối Gmail SMTP qua IPv6)
require('dns').setDefaultResultOrder('ipv4first');

const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { initSocket } = require('./socket');

const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const blogRoutes = require('./routes/blogRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');
const adminProductRoutes = require('./routes/admin/productRoutes');
const adminCategoryRoutes = require('./routes/admin/categoryRoutes');
const adminBlogRoutes = require('./routes/admin/blogRoutes');
const adminAuthRoutes = require('./routes/admin/authRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardRoutes');
const adminOrderRoutes = require('./routes/admin/orderRoutes');
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminNotificationRoutes = require('./routes/admin/notificationRoutes');
const adminSupportRoutes = require('./routes/admin/supportRoutes');
const adminHubRoutes = require('./routes/admin/hubRoutes');
const builderRoutes = require('./routes/builderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const hubRoutes = require('./routes/hubRoutes');
const chatRoutes = require('./routes/chatRoutes');
const supportRoutes = require('./routes/supportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const faqRoutes = require('./routes/faqRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const adminPromotionRoutes = require('./routes/admin/promotionRoutes');
const warrantyRoutes = require('./routes/warrantyRoutes');
const adminWarrantyRoutes = require('./routes/admin/warrantyRoutes');

connectDB();

// Log Mongoose connection events for monitoring
const mongoose = require('mongoose');
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: cho phép origin Vercel và localhost để tránh status 0 khi POST từ frontend deploy
const allowedOrigins = [
  'https://aura-pc-client.vercel.app',
  'https://aura-pc-admin.vercel.app',
  'https://aurapc-admin.vercel.app',
  'https://www.aurapc.io.vn',
  'https://aurapc.io.vn',
  'http://localhost:4200',
  'http://localhost:4201',
  'http://localhost:3000',
];
if (process.env.FRONTEND_URL) {
  try {
    const u = new URL(process.env.FRONTEND_URL);
    if (!allowedOrigins.includes(u.origin)) allowedOrigins.push(u.origin);
  } catch (_) { }
}
if (process.env.ADMIN_URL) {
  try {
    const u = new URL(process.env.ADMIN_URL);
    if (!allowedOrigins.includes(u.origin)) allowedOrigins.push(u.origin);
  } catch (_) { }
}
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.get('/', (req, res) => res.send('AuraPC Server is running...'));

// Health check cho Render
app.get('/health', (req, res) => {
  const dbState = require('mongoose').connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (dbState === 1) {
    return res.json({ status: 'ok', db: 'connected' });
  }
  res.status(503).json({ status: 'degraded', db: dbState === 2 ? 'connecting' : 'disconnected' });
});

app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/blogs', adminBlogRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use('/api/admin/hub', adminHubRoutes);
app.use('/api/builders', builderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/hub', hubRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/admin/promotions', adminPromotionRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/admin/warranty', adminWarrantyRoutes);

// Serve static files (uploads)
app.use('/uploads', express.static('uploads'));

// === Centralized Error Handler ===
// Catches errors thrown/passed via next(err) in any route
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error({ err, method: req.method, url: req.originalUrl }, err.message);
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
  });
});

const httpServer = http.createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, () => logger.info(`Server đang chạy trên cổng ${PORT}`));

// Graceful shutdown & crash prevention
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  // Cho server thời gian flush logs rồi thoát
  setTimeout(() => process.exit(1), 1000);
});

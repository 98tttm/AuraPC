require('dotenv').config();
// Ép DNS ưu tiên IPv4 (tránh ENETUNREACH khi Render kết nối Gmail SMTP qua IPv6)
require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

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
const builderRoutes = require('./routes/builderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const hubRoutes = require('./routes/hubRoutes');
const chatRoutes = require('./routes/chatRoutes');

connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: cho phép origin Vercel và localhost để tránh status 0 khi POST từ frontend deploy
const allowedOrigins = [
  'https://aura-pc-client.vercel.app',
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
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.get('/', (req, res) => res.send('AuraPC Server is running...'));

app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/blogs', adminBlogRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/builders', builderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/hub', hubRoutes);
app.use('/api/chat', chatRoutes);

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

app.listen(PORT, () => logger.info(`Server đang chạy trên cổng ${PORT}`));

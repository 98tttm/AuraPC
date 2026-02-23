require('dotenv').config();
// Ép DNS ưu tiên IPv4 (tránh ENETUNREACH khi Render kết nối Gmail SMTP qua IPv6)
require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const blogRoutes = require('./routes/blogRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');
const adminProductRoutes = require('./routes/admin/productRoutes');
const adminCategoryRoutes = require('./routes/admin/categoryRoutes');
const adminBlogRoutes = require('./routes/admin/blogRoutes');
const builderRoutes = require('./routes/builderRoutes');

connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('AuraPC Server is running...'));

app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/blogs', adminBlogRoutes);
app.use('/api/builders', builderRoutes);

// Serve static files (uploads)
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));

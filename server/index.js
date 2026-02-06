require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

// Kết nối Database
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send('AuraPC Server is running...');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});

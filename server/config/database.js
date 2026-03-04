const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 3000;

const connectDB = async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const conn = await mongoose.connect(process.env.MONGODB_URI, {
                serverSelectionTimeoutMS: 10000,
            });
            logger.info(`Kết nối Database AuraPC thành công: ${conn.connection.host}`);
            return;
        } catch (error) {
            logger.error(`Lỗi kết nối Database (lần ${attempt}/${MAX_RETRIES}): ${error.message}`);
            if (attempt === MAX_RETRIES) {
                logger.error('Không thể kết nối Database sau nhiều lần thử. Thoát.');
                process.exit(1);
            }
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            logger.info(`Thử lại sau ${delay / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};

module.exports = connectDB;

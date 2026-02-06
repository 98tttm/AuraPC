const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 6+ has these as default, but explicitly setting generic reliable options if needed.
            // In newer versions, useNewUrlParser and useUnifiedTopology are deprecated/default.
            // We can leave them out for Mongoose 7+.
        });

        console.log(`Kết nối Database AuraPC thành công: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Lỗi kết nối Database: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;

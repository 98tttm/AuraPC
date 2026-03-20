const mongoose = require('mongoose');

/**
 * OTP model: lưu mã OTP với TTL 5 phút.
 * MongoDB tự xóa document khi hết hạn nhờ `expires` index.
 */
const otpSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, expires: 300 }, // TTL 5 phút (300 giây)
});

module.exports = mongoose.model('Otp', otpSchema);

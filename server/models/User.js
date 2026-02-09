const mongoose = require('mongoose');

/**
 * User: đăng nhập bằng SĐT + OTP.
 * Các trường optional (email, username, profile, address, avatar) để trống lúc tạo, cập nhật sau.
 */
const userSchema = new mongoose.Schema(
  {
    email: { type: String, default: '' },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    username: { type: String, default: '' },
    profile: {
      fullName: { type: String, default: '' },
      dateOfBirth: { type: Date, default: null },
      gender: { type: String, default: '' },
    },
    address: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // Có thể mở rộng: street, ward, district, city, country, postalCode, ...
    },
    avatar: { type: String, default: '' },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true, strict: false }
);

userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);

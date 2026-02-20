const mongoose = require('mongoose');

/**
 * Address sub-schema: each user can have multiple addresses.
 */
const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Nhà riêng' },       // e.g. "Nhà riêng", "Công ty"
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, default: '' },                   // Tỉnh / Thành phố
    district: { type: String, default: '' },               // Quận / Huyện
    ward: { type: String, default: '' },                   // Phường / Xã
    address: { type: String, default: '' },                // Số nhà, tên đường
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false }
);

/**
 * User: đăng nhập bằng SĐT + OTP.
 * Các trường optional (email, username, profile, avatar) để trống lúc tạo, cập nhật sau.
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
    addresses: { type: [addressSchema], default: [] },
    avatar: { type: String, default: '' },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true, strict: false }
);

userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);

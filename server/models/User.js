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
 * User: đăng nhập bằng SĐT + OTP hoặc social login (Google, Facebook).
 * Các trường optional (email, username, profile, avatar) để trống lúc tạo, cập nhật sau.
 */
const userSchema = new mongoose.Schema(
  {
    email: { type: String, default: '' },
    phoneNumber: { type: String, unique: true, sparse: true, trim: true, default: null },
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
    // Social login
    googleId: { type: String, default: null },
    facebookId: { type: String, default: null },
    authProvider: { type: String, enum: ['phone', 'google', 'facebook'], default: 'phone' },
    // AuraHub social graph
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    // AuraHub posts mapping (store Post IDs)
    hubPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    hubReposts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  },
  { timestamps: true, strict: true }
);

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ facebookId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);

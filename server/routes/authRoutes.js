const express = require('express');
const User = require('../models/User');

const router = express.Router();

/** Chuẩn hóa SĐT: bỏ khoảng trắng/dấu, chỉ giữ số. */
function normalizePhone(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/\D/g, '');
}

/** Kiểm tra format SĐT Việt Nam: 10 số (0xxxxxxxxx) hoặc 11 số (84xxxxxxxxx). */
function isValidVietnamesePhone(phone) {
  const digits = normalizePhone(phone);
  if (digits.length === 10 && digits.startsWith('0')) return true;
  if (digits.length === 11 && digits.startsWith('84')) return true;
  return false;
}

/** Format SĐT lưu DB: 84xxxxxxxxx (11 số). */
function toStoredPhone(input) {
  const digits = normalizePhone(input);
  if (digits.length === 10 && digits.startsWith('0')) return '84' + digits.slice(1);
  if (digits.length === 11 && digits.startsWith('84')) return digits;
  return digits;
}

// OTP in-memory: { [storedPhone]: { code: string, expiresAt: number } }
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 phút

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** POST /api/auth/request-otp - Gửi OTP (log ra console). */
router.post('/request-otp', (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    const raw = (phoneNumber ?? '').trim();
    if (!raw) {
      return res.status(400).json({
        success: false,
        error: 'REQUIRED',
        message: 'Thông tin bắt buộc. Vui lòng nhập đầy đủ.',
      });
    }
    if (!isValidVietnamesePhone(raw)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'Số điện thoại không hợp lệ. Vui lòng thử lại hoặc đăng nhập bằng hình thức khác.',
      });
    }
    const stored = toStoredPhone(raw);
    const code = generateOtp();
    otpStore.set(stored, { code, expiresAt: Date.now() + OTP_TTL_MS });
    console.log('[AuraPC Auth] OTP cho', stored, ':', code, '(hiệu lực 5 phút)');
    const payload = { success: true, message: 'Mã OTP đã được gửi.' };
    if (process.env.NODE_ENV !== 'production') payload.devOtp = code;
    res.json(payload);
  } catch (err) {
    console.error('[POST /api/auth/request-otp]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/auth/verify-otp - Xác thực OTP, tạo/cập nhật user, trả về user. */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body || {};
    const raw = (phoneNumber ?? '').trim();
    const code = typeof otp === 'string' ? otp.replace(/\D/g, '') : String(otp || '');

    if (!raw || !isValidVietnamesePhone(raw)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'Số điện thoại không hợp lệ.',
      });
    }
    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP_LENGTH',
        message: 'Vui lòng nhập đủ 6 chữ số.',
      });
    }

    const stored = toStoredPhone(raw);
    const record = otpStore.get(stored);
    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'OTP_EXPIRED',
        message: 'Mã xác thực không chính xác. Vui lòng thử lại.',
      });
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(stored);
      return res.status(400).json({
        success: false,
        error: 'OTP_EXPIRED',
        message: 'Mã đã hết hạn. Vui lòng gửi lại mã.',
      });
    }
    if (record.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'OTP_INVALID',
        message: 'Mã xác thực không chính xác. Vui lòng thử lại.',
      });
    }
    otpStore.delete(stored);

    const now = new Date();
    let user = await User.findOne({ phoneNumber: stored }).lean();
    if (!user) {
      user = await User.create({
        phoneNumber: stored,
        email: '',
        username: '',
        profile: { fullName: '', dateOfBirth: null },
        address: null,
        avatar: '',
        active: true,
        lastLogin: now,
      });
      user = user.toObject ? user.toObject() : user;
    } else {
      await User.updateOne(
        { phoneNumber: stored },
        { $set: { lastLogin: now } }
      );
      user = await User.findOne({ phoneNumber: stored }).lean();
    }

    const out = { ...user };
    out.id = out._id.toString();
    res.json({ success: true, user: out });
  } catch (err) {
    console.error('[POST /api/auth/verify-otp]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

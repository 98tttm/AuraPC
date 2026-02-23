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
    // Trả OTP trong response khi: dev hoặc bật ENABLE_DEV_OTP_IN_RESPONSE (cho demo trên Vercel)
    const allowOtpInResponse = process.env.NODE_ENV !== 'production' ||
      (process.env.ENABLE_DEV_OTP_IN_RESPONSE === 'true' || process.env.ENABLE_DEV_OTP_IN_RESPONSE === '1');
    if (allowOtpInResponse) payload.devOtp = code;
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

    // ... (previous code)
    const out = { ...user };
    out.id = out._id.toString();
    res.json({ success: true, user: out });
  } catch (err) {
    console.error('[POST /api/auth/verify-otp]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// === Profile & Avatar ===
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads dir exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

/** PUT /api/auth/profile - Cß║ญp nhß║ญt th├╢ng tin c├í nh├вn */
router.put('/profile', async (req, res) => {
  try {
    const { userId, profile } = req.body; // profile: { fullName, gender, dateOfBirth }
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const update = {};
    if (profile.fullName !== undefined) update['profile.fullName'] = profile.fullName;
    if (profile.gender !== undefined) update['profile.gender'] = profile.gender;
    if (profile.dateOfBirth !== undefined) update['profile.dateOfBirth'] = profile.dateOfBirth;

    await User.findByIdAndUpdate(userId, { $set: update });
    const user = await User.findById(userId).lean();

    // Return updated user
    const out = { ...user };
    out.id = out._id.toString();
    res.json({ success: true, user: out });
  } catch (err) {
    console.error('[PUT /api/auth/profile]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/auth/avatar - Upload Avatar */
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // URL file: /uploads/filename
    const avatarUrl = `/uploads/${req.file.filename}`;

    await User.findByIdAndUpdate(userId, { $set: { avatar: avatarUrl } });
    const user = await User.findById(userId).lean();

    const out = { ...user };
    out.id = out._id.toString();
    res.json({ success: true, user: out, avatarUrl });
  } catch (err) {
    console.error('[POST /api/auth/avatar]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================== ADDRESS BOOK =====================

/** GET /api/auth/addresses/:userId — list all addresses */
router.get('/addresses/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, addresses: user.addresses || [] });
  } catch (err) {
    console.error('[GET /api/auth/addresses]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/auth/addresses — add new address */
router.post('/addresses', async (req, res) => {
  try {
    const { userId, label, fullName, phone, city, district, ward, address, isDefault } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    if (!fullName || !phone) return res.status(400).json({ success: false, message: 'fullName and phone are required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // If setting as default, clear other defaults
    if (isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }
    // If first address, auto-set as default
    const setDefault = isDefault || user.addresses.length === 0;

    user.addresses.push({
      label: label || 'Nhà riêng',
      fullName, phone,
      city: city || '', district: district || '', ward: ward || '',
      address: address || '',
      isDefault: setDefault,
    });

    await user.save();
    const updated = await User.findById(userId).lean();
    res.json({ success: true, addresses: updated.addresses });
  } catch (err) {
    console.error('[POST /api/auth/addresses]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PUT /api/auth/addresses/:addressId — update address */
router.put('/addresses/:addressId', async (req, res) => {
  try {
    const { userId, label, fullName, phone, city, district, ward, address, isDefault } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    if (label !== undefined) addr.label = label;
    if (fullName !== undefined) addr.fullName = fullName;
    if (phone !== undefined) addr.phone = phone;
    if (city !== undefined) addr.city = city;
    if (district !== undefined) addr.district = district;
    if (ward !== undefined) addr.ward = ward;
    if (address !== undefined) addr.address = address;
    if (isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
      addr.isDefault = true;
    }

    await user.save();
    const updated = await User.findById(userId).lean();
    res.json({ success: true, addresses: updated.addresses });
  } catch (err) {
    console.error('[PUT /api/auth/addresses]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/auth/addresses/:addressId — delete address */
router.delete('/addresses/:addressId', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    const wasDefault = addr.isDefault;
    user.addresses.pull(req.params.addressId);

    // If we deleted the default, set the first remaining as default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    const updated = await User.findById(userId).lean();
    res.json({ success: true, addresses: updated.addresses });
  } catch (err) {
    console.error('[DELETE /api/auth/addresses]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PUT /api/auth/addresses/:addressId/default — set as default */
router.put('/addresses/:addressId/default', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    user.addresses.forEach(a => { a.isDefault = false; });
    addr.isDefault = true;

    await user.save();
    const updated = await User.findById(userId).lean();
    res.json({ success: true, addresses: updated.addresses });
  } catch (err) {
    console.error('[PUT /api/auth/addresses/default]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

const express = require('express');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const OTP_MAX_ATTEMPTS = 3;
const OTP_LOCK_DURATION_MS = 60 * 60 * 1000; // 1 giờ

/** POST /api/auth/request-otp - Gửi OTP (log ra console). */
router.post('/request-otp', async (req, res) => {
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

    // Kiểm tra khóa tạm thời do nhập sai OTP quá nhiều lần
    const existing = await Otp.findOne({ phoneNumber: stored });
    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((existing.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        error: 'OTP_LOCKED',
        message: `Số điện thoại tạm khóa do nhập sai OTP quá ${OTP_MAX_ATTEMPTS} lần. Vui lòng thử lại sau ${minutesLeft} phút.`,
      });
    }

    const code = generateOtp();
    // Lưu OTP vào MongoDB (upsert: nếu đã có SĐT thì cập nhật code mới, reset attempts)
    await Otp.findOneAndUpdate(
      { phoneNumber: stored },
      { code, attempts: 0, lockedUntil: null, createdAt: new Date() },
      { upsert: true, new: true }
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AuraPC Auth] OTP cho', stored, ':', code, '(hiệu lực 5 phút)');
    }
    const payload = { success: true, message: 'Mã OTP đã được gửi.' };
    // Expose OTP in response for demo purposes (no SMS provider configured)
    payload.devOtp = code;
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
    const record = await Otp.findOne({ phoneNumber: stored });
    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'OTP_EXPIRED',
        message: 'Mã xác thực không chính xác hoặc đã hết hạn. Vui lòng thử lại.',
      });
    }

    // Kiểm tra khóa tạm thời
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        error: 'OTP_LOCKED',
        message: `Tài khoản tạm khóa do nhập sai OTP quá ${OTP_MAX_ATTEMPTS} lần. Vui lòng thử lại sau ${minutesLeft} phút.`,
      });
    }

    if (record.code !== code) {
      // OTP sai — tăng số lần thử
      const newAttempts = (record.attempts || 0) + 1;
      const updateFields = { attempts: newAttempts };
      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        updateFields.lockedUntil = new Date(Date.now() + OTP_LOCK_DURATION_MS);
      }
      await Otp.updateOne({ _id: record._id }, { $set: updateFields });

      const remaining = OTP_MAX_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        return res.status(429).json({
          success: false,
          error: 'OTP_LOCKED',
          message: `Nhập sai OTP quá ${OTP_MAX_ATTEMPTS} lần. Tài khoản tạm khóa 1 giờ.`,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'OTP_INVALID',
        message: `Mã xác thực không chính xác. Bạn còn ${remaining} lần thử.`,
      });
    }

    // OTP đúng — xóa record
    await Otp.deleteOne({ _id: record._id });

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
      const updateFields = { lastLogin: now };
      if (typeof user.email !== 'string') updateFields.email = '';
      await User.updateOne(
        { phoneNumber: stored },
        { $set: updateFields }
      );
      user = await User.findOne({ phoneNumber: stored }).lean();
    }

    const out = { ...user };
    out.id = out._id.toString();
    // Ký JWT token
    const token = signToken({ userId: out.id, phoneNumber: stored });
    res.json({ success: true, user: out, token });
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

/** PUT /api/auth/profile - Cập nhật thông tin cá nhân */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const profile = req.body?.profile && typeof req.body.profile === 'object' ? req.body.profile : {};
    const rawEmail = req.body?.email;

    const update = {};
    if (profile.fullName !== undefined) update['profile.fullName'] = profile.fullName;
    if (profile.gender !== undefined) update['profile.gender'] = profile.gender;
    if (profile.dateOfBirth !== undefined) update['profile.dateOfBirth'] = profile.dateOfBirth;
    if (rawEmail !== undefined) {
      const email = String(rawEmail || '').trim().toLowerCase();
      if (email && !EMAIL_RE.test(email)) {
        return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
      }
      update.email = email;
    }

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
router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.userId;
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

// ===================== FOLLOW (AuraHub) =====================

/** POST /api/auth/follow/:targetId - follow/unfollow user */
router.post('/follow/:targetId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const targetId = req.params.targetId;
    if (userId === targetId) {
      return res.status(400).json({ success: false, message: 'Bạn không thể follow chính mình.' });
    }

    const [me, target] = await Promise.all([
      User.findById(userId),
      User.findById(targetId),
    ]);
    if (!me || !target) {
      return res.status(404).json({ success: false, message: 'User không tồn tại.' });
    }

    const isFollowing = me.following.some((id) => id.toString() === targetId);
    if (isFollowing) {
      // Unfollow
      me.following = me.following.filter((id) => id.toString() !== targetId);
      target.followers = target.followers.filter((id) => id.toString() !== userId);
    } else {
      me.following.push(target._id);
      target.followers.push(me._id);
    }
    me.followingCount = me.following.length;
    target.followerCount = target.followers.length;

    await Promise.all([me.save(), target.save()]);

    return res.json({
      success: true,
      following: !isFollowing,
      followerCount: target.followerCount,
      followingCount: me.followingCount,
    });
  } catch (err) {
    console.error('[POST /api/auth/follow/:targetId]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/auth/followers/:userId - list followers */
router.get('/followers/:userId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', 'username avatar profile phoneNumber')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'User không tồn tại.' });
    res.json({
      success: true,
      followerCount: user.followerCount || (user.followers?.length ?? 0),
      followers: user.followers || [],
    });
  } catch (err) {
    console.error('[GET /api/auth/followers/:userId]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/auth/following/:userId - list following */
router.get('/following/:userId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', 'username avatar profile phoneNumber')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'User không tồn tại.' });
    res.json({
      success: true,
      followingCount: user.followingCount || (user.following?.length ?? 0),
      following: user.following || [],
    });
  } catch (err) {
    console.error('[GET /api/auth/following/:userId]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================== ADDRESS BOOK =====================

/** GET /api/auth/addresses/:userId — list all addresses */
router.get('/addresses/:userId', requireAuth, async (req, res) => {
  try {
    if (req.params.userId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, addresses: user.addresses || [] });
  } catch (err) {
    console.error('[GET /api/auth/addresses]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/auth/addresses — add new address */
router.post('/addresses', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { label, fullName, phone, city, district, ward, address, isDefault } = req.body || {};
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
router.put('/addresses/:addressId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { label, fullName, phone, city, district, ward, address, isDefault } = req.body || {};

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
router.delete('/addresses/:addressId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

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
router.put('/addresses/:addressId/default', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

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

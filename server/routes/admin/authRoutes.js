const express = require('express');
const Admin = require('../../models/Admin');
const { signToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

/** POST /login — đăng nhập admin bằng email + password */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = signToken({ adminId: admin._id, isAdmin: true });
    res.json({
      success: true,
      token,
      admin: { _id: admin._id, email: admin.email, name: admin.name, avatar: admin.avatar },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /me — thông tin admin hiện tại */
router.get('/me', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.adminId).select('-password').lean();
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /seed — tạo admin đầu tiên (bảo vệ bằng ADMIN_SEED_SECRET) */
router.post('/seed', async (req, res) => {
  try {
    const secret = process.env.ADMIN_SEED_SECRET;
    if (!secret || req.body.secret !== secret) {
      return res.status(403).json({ success: false, message: 'Invalid seed secret' });
    }

    const existing = await Admin.countDocuments();
    if (existing > 0) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = new Admin({ email, password, name: name || 'Admin' });
    await admin.save();
    res.status(201).json({ success: true, message: 'Admin created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

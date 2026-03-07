const express = require('express');
const UserNotification = require('../models/UserNotification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** GET / — list notifications for current user */
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const unreadOnly = req.query.unreadOnly === 'true';
    const userId = req.userId;

    const filter = { user: userId };
    if (unreadOnly) filter.readAt = null;

    const [items, unreadCount] = await Promise.all([
      UserNotification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      UserNotification.countDocuments({ user: userId, readAt: null }),
    ]);

    res.json({ items, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /:id/read — mark one as read */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const updated = await UserNotification.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /read-all — mark all as read for current user */
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const result = await UserNotification.updateMany(
      { user: req.userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

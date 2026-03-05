const express = require('express');
const AdminNotification = require('../../models/AdminNotification');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

/** GET / - notification list + unread count */
router.get('/', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';
    const unreadFilter = { readBy: { $nin: [req.adminId] } };
    const filter = unreadOnly ? unreadFilter : {};

    const [items, unreadCount] = await Promise.all([
      AdminNotification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      AdminNotification.countDocuments(unreadFilter),
    ]);

    res.json({ items, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /:id/read - mark one notification as read for current admin */
router.patch('/:id/read', async (req, res) => {
  try {
    const updated = await AdminNotification.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { readBy: req.adminId } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /read-all - mark all notifications as read for current admin */
router.patch('/read-all', async (req, res) => {
  try {
    const unreadFilter = { readBy: { $nin: [req.adminId] } };
    const result = await AdminNotification.updateMany(
      unreadFilter,
      { $addToSet: { readBy: req.adminId } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

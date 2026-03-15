const express = require('express');
const Promotion = require('../../models/Promotion');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET / — list all promotions (paginated)
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  const filter = {};
  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Promotion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Promotion.countDocuments(filter),
  ]);
  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /:id — single promotion
router.get('/:id', async (req, res) => {
  const item = await Promotion.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi.' });
  res.json(item);
});

// POST / — create promotion
router.post('/', async (req, res) => {
  const { code, description, discountPercent, maxDiscountAmount, minOrderAmount, maxUsage, maxUsagePerUser, startDate, endDate, isActive } = req.body;
  const promotion = new Promotion({
    code, description, discountPercent, maxDiscountAmount, minOrderAmount,
    maxUsage, maxUsagePerUser, startDate, endDate, isActive,
  });
  await promotion.save();
  res.status(201).json(promotion);
});

// PUT /:id — update promotion
router.put('/:id', async (req, res) => {
  const { code, description, discountPercent, maxDiscountAmount, minOrderAmount, maxUsage, maxUsagePerUser, startDate, endDate, isActive } = req.body;
  const promotion = await Promotion.findByIdAndUpdate(
    req.params.id,
    { code, description, discountPercent, maxDiscountAmount, minOrderAmount, maxUsage, maxUsagePerUser, startDate, endDate, isActive },
    { new: true, runValidators: true }
  );
  if (!promotion) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi.' });
  res.json(promotion);
});

// DELETE /:id — delete promotion
router.delete('/:id', async (req, res) => {
  const result = await Promotion.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi.' });
  res.json({ deleted: true });
});

module.exports = router;

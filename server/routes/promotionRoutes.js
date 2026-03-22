const express = require('express');
const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');

const router = express.Router();

// POST /api/promotions/validate — validate & preview a voucher code
router.post('/validate', async (req, res) => {
  try {
    const { code, orderAmount, userId } = req.body;

    if (!code || orderAmount == null) {
      return res.status(400).json({ valid: false, message: 'Thiếu mã hoặc giá trị đơn hàng.' });
    }

    const promotion = await Promotion.findOne({
      code: code.toUpperCase().trim(),
      isActive: true,
    }).lean();

    if (!promotion) {
      return res.json({ valid: false, message: 'Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa.' });
    }

    const now = new Date();
    if (now < new Date(promotion.startDate)) {
      return res.json({ valid: false, message: 'Mã giảm giá chưa có hiệu lực.' });
    }
    if (now > new Date(promotion.endDate)) {
      return res.json({ valid: false, message: 'Mã giảm giá đã hết hạn.' });
    }

    if (promotion.maxUsage != null && promotion.usedCount >= promotion.maxUsage) {
      return res.json({ valid: false, message: 'Mã giảm giá đã hết lượt sử dụng.' });
    }

    if (orderAmount < promotion.minOrderAmount) {
      return res.json({
        valid: false,
        message: `Đơn hàng tối thiểu ${promotion.minOrderAmount.toLocaleString('vi-VN')}đ để sử dụng mã này.`,
      });
    }

    if (userId) {
      const userUsageCount = await PromotionUsage.countDocuments({
        promotion: promotion._id,
        user: userId,
      });
      if (userUsageCount >= promotion.maxUsagePerUser) {
        return res.json({ valid: false, message: 'Bạn đã sử dụng mã này đủ số lần cho phép.' });
      }
    }

    const rawDiscount = (orderAmount * promotion.discountPercent) / 100;
    const discountAmount =
      promotion.maxDiscountAmount != null
        ? Math.min(rawDiscount, promotion.maxDiscountAmount)
        : rawDiscount;

    res.json({
      valid: true,
      promotion: {
        _id: promotion._id,
        code: promotion.code,
        description: promotion.description,
        discountPercent: promotion.discountPercent,
        discountAmount: Math.round(discountAmount),
        maxDiscountAmount: promotion.maxDiscountAmount ?? null,
      },
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Lỗi hệ thống, vui lòng thử lại.' });
  }
});

module.exports = router;

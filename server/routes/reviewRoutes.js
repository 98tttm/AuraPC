const express = require('express');
const mongoose = require('mongoose');
const ProductReview = require('../models/ProductReview');
const Order = require('../models/Order');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** Kiểm tra user đã mua và đã nhận hàng (delivered) sản phẩm productId chưa */
async function userCanReview(userId, productId) {
  if (!userId || !productId || !mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
    return false;
  }
  const userObjId = new mongoose.Types.ObjectId(userId);
  const productObjId = new mongoose.Types.ObjectId(productId);
  const order = await Order.findOne({
    user: userObjId,
    status: 'delivered',
    'items.product': productObjId,
  }).lean();
  return !!order;
}

/** GET /api/reviews?productId=...&filter=all|newest|with_photo&type=all|review|comment
 *  Trả về danh sách review/comment của sản phẩm (chỉ bài gốc, không bao gồm replies trong list chính).
 *  Replies được populate riêng hoặc trả kèm trong từng item.
 */
router.get('/', async (req, res) => {
  try {
    const { productId, filter = 'all', type = 'all', rating, sort: sortParam = 'newest' } = req.query;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'productId required and must be valid' });
    }
    const productObjId = new mongoose.Types.ObjectId(productId);
    const q = { product: productObjId, parent: null };
    if (type === 'review') q.type = 'review';
    else if (type === 'comment') q.type = 'comment';

    if (filter === 'with_photo') {
      q['images.0'] = { $exists: true };
    }
    if (rating != null && rating !== '' && rating !== 'all') {
      const r = parseInt(rating, 10);
      if (r >= 1 && r <= 5) q.rating = r;
    }

    const sort = sortParam === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    const items = await ProductReview.find(q)
      .sort(sort)
      .populate('user', 'profile.fullName phoneNumber username')
      .lean();

    // Thống kê rating luôn lấy từ TẤT CẢ đánh giá của sản phẩm (không phụ thuộc bộ lọc)
    const allReviewsForStats = await ProductReview.find({ product: productObjId, parent: null, type: 'review' }).select('rating').lean();
    const avgRating = allReviewsForStats.length
      ? allReviewsForStats.reduce((s, r) => s + (r.rating || 0), 0) / allReviewsForStats.length
      : 0;
    const ratingBars = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: allReviewsForStats.filter((r) => r.rating === star).length,
    }));

    // Populate replies cho từng item
    const withReplies = await Promise.all(
      items.map(async (item) => {
        const replies = await ProductReview.find({ parent: item._id })
          .sort({ createdAt: 1 })
          .populate('user', 'profile.fullName phoneNumber username')
          .lean();
        return { ...item, replies };
      })
    );

    const reviewsOnly = items.filter((i) => i.type === 'review');

    res.json({
      items: withReplies,
      total: items.length,
      avgRating: Math.round(avgRating * 10) / 10,
      ratingBars,
      reviewCount: reviewsOnly.length,
      commentCount: items.filter((i) => i.type === 'comment').length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/reviews/can-review?productId=... */
router.get('/can-review', requireAuth, async (req, res) => {
  try {
    const { productId } = req.query;
    const userId = req.userId;
    if (!productId) {
      return res.status(400).json({ error: 'productId required' });
    }
    const can = await userCanReview(userId, productId);
    res.json({ canReview: can });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/reviews - Tạo đánh giá hoặc bình luận */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { productId, type, content, rating, images } = req.body;
    if (!productId || !userId || !type || !content || typeof content !== 'string') {
      return res.status(400).json({ error: 'productId, userId, type, content required' });
    }
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid productId or userId' });
    }
    if (!['review', 'comment'].includes(type)) {
      return res.status(400).json({ error: 'type must be review or comment' });
    }

    const contentTrimmed = content.trim();
    if (!contentTrimmed) {
      return res.status(400).json({ error: 'content cannot be empty' });
    }

    if (type === 'review') {
      const can = await userCanReview(userId, productId);
      if (!can) {
        return res.status(403).json({
          error: 'Chỉ khách hàng đã mua và đã nhận hàng mới được đánh giá sản phẩm.',
        });
      }
      const existing = await ProductReview.findOne({ product: productId, user: userId, type: 'review', parent: null });
      if (existing) {
        return res.status(409).json({ error: 'Bạn đã đánh giá sản phẩm này rồi.' });
      }
      const r = Number(rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: 'rating must be 1-5 for review' });
      }
    }

    const user = await User.findById(userId).select('profile.fullName phoneNumber username').lean();
    const displayName =
      (user?.profile?.fullName && user.profile.fullName.trim()) ||
      user?.username ||
      (user?.phoneNumber ? user.phoneNumber.replace(/(\d{4})(\d{3})(\d{3})/, '$1***$3') : 'Khách');

    const doc = new ProductReview({
      product: productId,
      user: userId,
      type,
      content: contentTrimmed,
      rating: type === 'review' ? Math.round(Number(rating)) : undefined,
      images: Array.isArray(images) ? images.filter((u) => typeof u === 'string') : [],
    });
    await doc.save();
    const populated = await ProductReview.findById(doc._id)
      .populate('user', 'profile.fullName phoneNumber username')
      .lean();

    res.status(201).json({ ...populated, userDisplayName: displayName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/reviews/:reviewId/reply - Phản hồi (reply) */
router.post('/:reviewId/reply', requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.userId;
    const { content } = req.body;
    if (!reviewId || !userId || !content || typeof content !== 'string') {
      return res.status(400).json({ error: 'reviewId, userId, content required' });
    }
    if (!mongoose.Types.ObjectId.isValid(reviewId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid reviewId or userId' });
    }

    const parent = await ProductReview.findById(reviewId).lean();
    if (!parent) return res.status(404).json({ error: 'Review/Comment not found' });

    const contentTrimmed = content.trim();
    if (!contentTrimmed) {
      return res.status(400).json({ error: 'content cannot be empty' });
    }

    const doc = new ProductReview({
      product: parent.product,
      user: userId,
      type: 'comment',
      content: contentTrimmed,
      parent: reviewId,
    });
    await doc.save();
    const populated = await ProductReview.findById(doc._id)
      .populate('user', 'profile.fullName phoneNumber username')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const mongoose = require('mongoose');

/**
 * ProductReview: đánh giá (có sao) hoặc bình luận (không sao).
 * - Đánh giá: chỉ user đã mua và đã nhận hàng (order delivered) mới được gửi.
 * - Bình luận: mọi user đã đăng nhập đều được gửi.
 * - parent: null = bài gốc; có giá trị = reply (phản hồi).
 */
const productReviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** 'review' = đánh giá có sao; 'comment' = bình luận không sao */
    type: { type: String, enum: ['review', 'comment'], required: true },
    /** 1-5, chỉ có khi type === 'review' */
    rating: { type: Number, min: 1, max: 5 },
    content: { type: String, required: true, trim: true },
    /** URL ảnh đính kèm (optional) */
    images: { type: [String], default: [] },
    /** parent = null: bài gốc; parent = _id của review/comment khác: phản hồi */
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductReview', default: null },
  },
  { timestamps: true }
);

productReviewSchema.index({ product: 1, parent: 1, createdAt: -1 });
productReviewSchema.index({ product: 1, type: 1 });
productReviewSchema.index({ user: 1, product: 1, type: 1 });

module.exports = mongoose.model('ProductReview', productReviewSchema);

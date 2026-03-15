const mongoose = require('mongoose');

const promotionUsageSchema = new mongoose.Schema({
  promotion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promotion',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  usedAt: { type: Date, default: Date.now },
});

promotionUsageSchema.index({ promotion: 1, user: 1 });

module.exports = mongoose.model('PromotionUsage', promotionUsageSchema);

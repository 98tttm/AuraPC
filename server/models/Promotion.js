const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: '' },
    discountPercent: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    maxDiscountAmount: { type: Number, default: null },
    minOrderAmount: { type: Number, default: 0 },
    maxUsage: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    maxUsagePerUser: { type: Number, default: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

promotionSchema.index({ code: 1 });
promotionSchema.index({ endDate: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);

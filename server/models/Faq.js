const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'chung' }, // chung, don-hang, thanh-toan, bao-hanh, khac
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

faqSchema.index({ category: 1, order: 1 });

module.exports = mongoose.model('Faq', faqSchema);

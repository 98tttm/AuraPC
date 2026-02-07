const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    price: { type: Number, required: true },
    salePrice: { type: Number, default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, default: '' },
      },
    ],
    specs: { type: mongoose.Schema.Types.Mixed, default: {} },
    stock: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ featured: 1, active: 1 });

module.exports = mongoose.model('Product', productSchema);

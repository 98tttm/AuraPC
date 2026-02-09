const mongoose = require('mongoose');

/**
 * Schema khớp MongoDB: name, slug, price, salePrice, primaryCategoryId (số), categoryIds, images, ...
 * Hỗ trợ cả category (ObjectId) và primaryCategoryId (số) để lọc và resolve danh mục.
 */
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    description_html: { type: String, default: '' },
    price: { type: Number, required: true },
    salePrice: { type: Number, default: null },
    old_price: { type: Number, default: null },
    category: { type: mongoose.Schema.Types.Mixed, default: null },
    category_id: { type: String, default: '' },
    category_ids: { type: [String], default: [] },
    primaryCategoryId: { type: Number, default: null },
    categoryIds: { type: [Number], default: [] },
    images: mongoose.Schema.Types.Mixed,
    specs: { type: mongoose.Schema.Types.Mixed, default: {} },
    techSpecs: { type: mongoose.Schema.Types.Mixed, default: {} },
    brand: { type: String, default: '' },
    stock: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false }
);

productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ category_id: 1 });
productSchema.index({ category_ids: 1 });
productSchema.index({ primaryCategoryId: 1 });
productSchema.index({ featured: 1, active: 1 });

module.exports = mongoose.model('Product', productSchema);

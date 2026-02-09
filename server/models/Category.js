const mongoose = require('mongoose');

/**
 * Schema khớp với collection categories trong MongoDB AuraPC của bạn (Compass):
 * _id (có thể Number/ObjectId), name, slug, url, parent_id, level, product_count,
 * product_ids, description, image, is_active, display_order, meta.
 */
const categorySchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.Mixed, required: false },
    category_id: { type: String, default: '' },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    url: { type: String, default: '' },
    source_url: { type: String, default: '' },
    parent_id: { type: mongoose.Schema.Types.Mixed, default: null },
    level: { type: Number, default: 0 },
    product_count: { type: Number, default: 0 },
    product_ids: { type: [mongoose.Schema.Types.Mixed], default: [] },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
    display_order: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: false }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ category_id: 1 });
categorySchema.index({ parent_id: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ display_order: 1 });

module.exports = mongoose.model('Category', categorySchema);

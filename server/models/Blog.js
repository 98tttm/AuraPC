const mongoose = require('mongoose');

/**
 * Schema khớp MongoDB: title, slug, excerpt, content, coverImage, author, publishedAt, category, handle, url.
 */
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    author: { type: String, default: 'AuraPC' },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: false }
);

blogSchema.index({ slug: 1 });
blogSchema.index({ published: 1 });

module.exports = mongoose.model('Blog', blogSchema);

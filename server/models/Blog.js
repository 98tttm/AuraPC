const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    author: { type: String, default: 'AuraPC' },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogSchema.index({ slug: 1 });
blogSchema.index({ published: 1 });

module.exports = mongoose.model('Blog', blogSchema);

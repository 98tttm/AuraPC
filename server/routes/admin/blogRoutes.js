const express = require('express');
const Blog = require('../../models/Blog');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

function extractCoverImageFromContent(html) {
  if (!html || typeof html !== 'string') return '';

  // Ưu tiên: tìm block nội dung chính (article__content / article-content / article-body)
  const contentPatterns = [
    /<div[^>]+class=["'][^"']*article__content[^"']*["'][^>]*>/i,
    /<div[^>]+class=["'][^"']*article-content[^"']*["'][^>]*>/i,
    /<div[^>]+class=["'][^"']*article-body[^"']*["'][^>]*>/i,
    /<div[^>]+class=["'][^"']*content_style_list[^"']*["'][^>]*>/i,
  ];

  let searchHtml = html;
  for (const re of contentPatterns) {
    const m = html.match(re);
    if (m) {
      const idx = html.indexOf(m[0]);
      if (idx >= 0) {
        searchHtml = html.slice(idx);
        break;
      }
    }
  }

  // Lấy ảnh <img> đầu tiên kể từ block nội dung trở xuống
  const firstImg = searchHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (firstImg && firstImg[1]) {
    return firstImg[1];
  }

  return '';
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      Blog.find({}).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      Blog.countDocuments({}),
    ]);
    res.json({ items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.coverImage && body.content) {
      const cover = extractCoverImageFromContent(body.content);
      if (cover) body.coverImage = cover;
    }
    const post = new Blog(body);
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.coverImage && body.content) {
      const cover = extractCoverImageFromContent(body.content);
      if (cover) body.coverImage = cover;
    }
    const post = await Blog.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/backfill-covers', async (req, res) => {
  try {
    const posts = await Blog.find({}).lean();
    let updated = 0;

    for (const doc of posts) {
      const html = doc.content || '';
      const current = (doc.coverImage || '').trim();
      const extracted = extractCoverImageFromContent(html);

      if (extracted && extracted !== current) {
        await Blog.updateOne({ _id: doc._id }, { $set: { coverImage: extracted } });
        updated += 1;
      }
    }

    res.json({ updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const post = await Blog.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

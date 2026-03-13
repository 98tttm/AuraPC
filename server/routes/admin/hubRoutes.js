const express = require('express');
const Post = require('../../models/Post');
const HubComment = require('../../models/HubComment');
const Share = require('../../models/Share');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// Require admin for all routes
router.use(requireAdmin);

// GET /api/admin/hub/posts
// Danh sách bài AuraHub với lọc trạng thái/topic/search
router.get('/posts', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'pending',
      topic,
      search,
      sort = 'newest',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (topic) {
      filter.topic = topic;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.content = regex;
    }

    let sortOpt = { createdAt: -1 };
    if (sort === 'trending') {
      sortOpt = { likeCount: -1, commentCount: -1, createdAt: -1 };
    }

    const [items, total] = await Promise.all([
      Post.find(filter)
        .sort(sortOpt)
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'username avatar profile phoneNumber')
        .lean(),
      Post.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum,
    });
  } catch (err) {
    console.error('Admin Hub GET /posts error:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// GET /api/admin/hub/posts/:id
// Xem chi tiết 1 bài
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar profile phoneNumber')
      .populate('repostedBy', 'username avatar profile')
      .populate({ path: 'originalPost', populate: { path: 'author', select: 'username avatar profile' } })
      .lean();

    if (!post) {
      return res.status(404).json({ message: 'Bài đăng không tồn tại' });
    }

    res.json(post);
  } catch (err) {
    console.error('Admin Hub GET /posts/:id error:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// PATCH /api/admin/hub/posts/:id/approve
// Duyệt bài
router.patch('/posts/:id/approve', async (req, res) => {
  try {
    const { forcePublishNow } = req.body || {};
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Bài đăng không tồn tại' });
    }

    const now = new Date();

    post.status = 'approved';
    post.reviewedBy = req.adminId || null;
    post.reviewedAt = now;
    post.rejectedReason = null;

    if (!post.scheduledAt || forcePublishNow === true || post.scheduledAt <= now) {
      post.isPublished = true;
      if (forcePublishNow === true) {
        post.scheduledAt = null;
      }
    } else {
      post.isPublished = false;
    }

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'username avatar profile phoneNumber')
      .lean();

    res.json(populated);
  } catch (err) {
    console.error('Admin Hub PATCH /posts/:id/approve error:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// PATCH /api/admin/hub/posts/:id/reject
// Từ chối bài
router.patch('/posts/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Bài đăng không tồn tại' });
    }

    post.status = 'rejected';
    post.rejectedReason = reason.trim();
    post.reviewedBy = req.adminId || null;
    post.reviewedAt = new Date();
    post.isPublished = false;

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'username avatar profile phoneNumber')
      .lean();

    res.json(populated);
  } catch (err) {
    console.error('Admin Hub PATCH /posts/:id/reject error:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// DELETE /api/admin/hub/posts/:id
// Xóa bài cùng comments/shares liên quan
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Bài đăng không tồn tại' });
    }

    await HubComment.deleteMany({ post: post._id });
    await Share.deleteMany({ post: post._id });
    await post.deleteOne();

    res.json({ message: 'Đã xóa bài đăng' });
  } catch (err) {
    console.error('Admin Hub DELETE /posts/:id error:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// GET /api/admin/hub/posts/:id/comments
// Danh sách bình luận của 1 bài (bao gồm replies)
router.get('/posts/:id/comments', async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Bài đăng không tồn tại' });
    }

    // Top-level comments
    const comments = await HubComment.find({ post: postId, parentComment: null })
      .sort({ createdAt: -1 })
      .populate('author', 'username avatar profile phoneNumber')
      .lean();

    // Replies for each top-level comment
    const commentIds = comments.map((c) => c._id);
    const replies = await HubComment.find({ parentComment: { $in: commentIds } })
      .sort({ createdAt: 1 })
      .populate('author', 'username avatar profile phoneNumber')
      .lean();

    const repliesMap = {};
    for (const r of replies) {
      const pid = r.parentComment.toString();
      if (!repliesMap[pid]) repliesMap[pid] = [];
      repliesMap[pid].push(r);
    }

    const result = comments.map((c) => ({
      ...c,
      replies: repliesMap[c._id.toString()] || [],
    }));

    res.json(result);
  } catch (err) {
    console.error('Admin Hub GET /posts/:id/comments error:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// DELETE /api/admin/hub/comments/:id
// Admin xóa bình luận bất kỳ
router.delete('/comments/:id', async (req, res) => {
  try {
    const comment = await HubComment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Bình luận không tồn tại' });
    }

    const postId = comment.post;

    if (comment.parentComment) {
      // Reply: decrement parent's replyCount
      await HubComment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: -1 } });
      await comment.deleteOne();
      await Post.findByIdAndUpdate(postId, { $inc: { commentCount: -1 } });
    } else {
      // Top-level: delete all replies + the comment
      const replyCount = await HubComment.countDocuments({ parentComment: comment._id });
      await HubComment.deleteMany({ parentComment: comment._id });
      await comment.deleteOne();
      await Post.findByIdAndUpdate(postId, { $inc: { commentCount: -(1 + replyCount) } });
    }

    res.json({ message: 'Đã xóa bình luận' });
  } catch (err) {
    console.error('Admin Hub DELETE /comments/:id error:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;


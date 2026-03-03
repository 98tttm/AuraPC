const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');
const HubComment = require('../models/HubComment');
const Share = require('../models/Share');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// === Upload config ===
const uploadDir = 'uploads/hub';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'hub-' + unique + path.extname(file.originalname));
    },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// === Default topic list ===
const DEFAULT_TOPICS = [
    'Tin tức', 'Kiến thức', 'Hỏi đáp', 'Build PC',
    'Review', 'Deal hot', 'Chia sẻ', 'Thảo luận',
    'Phần mềm', 'Mẹo vặt',
];

// ─── POSTS ───────────────────────────────────────────────

/** GET /api/hub/posts — Feed (phân trang, lọc topic, sort) */
router.get('/posts', async (req, res) => {
    try {
        const { page = 1, limit = 10, topic, sort = 'newest' } = req.query;
        const filter = { isPublished: true };
        if (topic) filter.topic = topic;

        let sortOpt = { createdAt: -1 };
        if (sort === 'trending') sortOpt = { likeCount: -1, commentCount: -1, createdAt: -1 };

        const skip = (Number(page) - 1) * Number(limit);
        const [posts, total] = await Promise.all([
            Post.find(filter)
                .sort(sortOpt)
                .skip(skip)
                .limit(Number(limit))
                .populate('author', 'username avatar profile phoneNumber')
                .populate({ path: 'originalPost', populate: { path: 'author', select: 'username avatar profile' } })
                .lean(),
            Post.countDocuments(filter),
        ]);

        res.json({ posts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error('Hub GET /posts error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** GET /api/hub/posts/:id — Chi tiết bài + tăng viewCount */
router.get('/posts/:id', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { $inc: { viewCount: 1 } },
            { new: true }
        )
            .populate('author', 'username avatar profile phoneNumber')
            .populate({ path: 'originalPost', populate: { path: 'author', select: 'username avatar profile' } })
            .lean();

        if (!post) return res.status(404).json({ message: 'Bài đăng không tồn tại' });
        res.json(post);
    } catch (err) {
        console.error('Hub GET /posts/:id error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** POST /api/hub/posts — Tạo bài mới */
router.post('/posts', requireAuth, async (req, res) => {
    try {
        const { content, images, topic, poll, replyOption, scheduledAt } = req.body;

        if (!content && (!images || !images.length) && (!poll || !poll.options?.length)) {
            return res.status(400).json({ message: 'Bài đăng cần có nội dung, ảnh hoặc poll.' });
        }

        const postData = {
            author: req.userId,
            content: content || '',
            images: images || [],
            topic: topic || '',
            replyOption: replyOption || 'anyone',
        };

        // Poll
        if (poll && poll.options && poll.options.length >= 2) {
            postData.poll = {
                options: poll.options.map((o) => ({ text: o.text || o, votes: [], voteCount: 0 })),
                endsAt: poll.endsAt ? new Date(poll.endsAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
                totalVotes: 0,
            };
        }

        // Schedule
        if (scheduledAt) {
            postData.scheduledAt = new Date(scheduledAt);
            postData.isPublished = false;
        }

        const post = await Post.create(postData);

        // Link post vào user.hubPosts để lưu postId theo user
        await User.findByIdAndUpdate(
            req.userId,
            { $addToSet: { hubPosts: post._id } },
            { new: false }
        );

        const populated = await Post.findById(post._id)
            .populate('author', 'username avatar profile phoneNumber')
            .lean();

        res.status(201).json(populated);
    } catch (err) {
        console.error('Hub POST /posts error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** PUT /api/hub/posts/:id — Sửa bài (chỉ author) */
router.put('/posts/:id', requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài' });
        if (post.author.toString() !== req.userId) return res.status(403).json({ message: 'Không có quyền' });

        const { content, images, topic } = req.body;
        if (content !== undefined) post.content = content;
        if (images !== undefined) post.images = images;
        if (topic !== undefined) post.topic = topic;

        await post.save();
        const updated = await Post.findById(post._id).populate('author', 'username avatar profile phoneNumber').lean();
        res.json(updated);
    } catch (err) {
        console.error('Hub PUT /posts/:id error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** DELETE /api/hub/posts/:id — Xóa bài (chỉ author) */
router.delete('/posts/:id', requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài' });
        if (post.author.toString() !== req.userId) return res.status(403).json({ message: 'Không có quyền' });

        await HubComment.deleteMany({ post: post._id });
        await Share.deleteMany({ post: post._id });
        await post.deleteOne();

        // Gỡ post khỏi các danh sách hubPosts / hubReposts trên user (nếu có)
        await User.updateMany(
            {},
            {
                $pull: {
                    hubPosts: post._id,
                    hubReposts: post._id,
                },
            }
        );

        res.json({ message: 'Đã xóa bài đăng' });
    } catch (err) {
        console.error('Hub DELETE /posts/:id error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ─── INTERACTIONS ────────────────────────────────────────

/** POST /api/hub/posts/:id/like — Toggle thả tim */
router.post('/posts/:id/like', requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài' });

        const idx = post.likes.indexOf(req.userId);
        if (idx === -1) {
            post.likes.push(req.userId);
            post.likeCount = post.likes.length;
        } else {
            post.likes.splice(idx, 1);
            post.likeCount = post.likes.length;
        }
        await post.save();

        res.json({ liked: idx === -1, likeCount: post.likeCount });
    } catch (err) {
        console.error('Hub POST like error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** POST /api/hub/posts/:id/repost — Repost bài */
router.post('/posts/:id/repost', requireAuth, async (req, res) => {
    try {
        const original = await Post.findById(req.params.id);
        if (!original) return res.status(404).json({ message: 'Không tìm thấy bài gốc' });

        // Check duplicate repost
        const existing = await Post.findOne({ isRepost: true, originalPost: original._id, repostedBy: req.userId });
        if (existing) return res.status(400).json({ message: 'Bạn đã repost bài này rồi' });

        const repost = await Post.create({
            author: original.author,
            content: original.content,
            images: original.images,
            topic: original.topic,
            isRepost: true,
            originalPost: original._id,
            repostedBy: req.userId,
        });

        original.repostCount += 1;
        await original.save();

        // Link repost vào user.hubReposts
        await User.findByIdAndUpdate(
            req.userId,
            { $addToSet: { hubReposts: repost._id } },
            { new: false }
        );

        const populated = await Post.findById(repost._id)
            .populate('author', 'username avatar profile phoneNumber')
            .populate('repostedBy', 'username avatar profile')
            .populate({ path: 'originalPost', populate: { path: 'author', select: 'username avatar profile' } })
            .lean();

        res.status(201).json(populated);
    } catch (err) {
        console.error('Hub POST repost error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** POST /api/hub/posts/:id/share — Ghi nhận share */
router.post('/posts/:id/share', requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài' });

        const { method } = req.body;
        await Share.create({ post: post._id, user: req.userId, method: method || 'copy_link' });

        post.shareCount += 1;
        await post.save();

        res.json({ shareCount: post.shareCount });
    } catch (err) {
        console.error('Hub POST share error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ─── USER ACTIVITY (for AuraHub profile) ─────────────────

/** GET /api/hub/user/:userId/posts?type=threads|media|reposts */
router.get('/user/:userId/posts', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type = 'threads' } = req.query;

        const baseFilter = { isPublished: true };
        let filter = { ...baseFilter, author: userId };

        if (type === 'media') {
            filter = {
                ...filter,
                images: { $exists: true, $ne: [], $not: { $size: 0 } },
            };
        }

        if (type === 'reposts') {
            filter = {
                isRepost: true,
                repostedBy: userId,
            };
        }

        const posts = await Post.find(filter)
            .sort({ createdAt: -1 })
            .populate('author', 'username avatar profile phoneNumber')
            .populate('repostedBy', 'username avatar profile')
            .populate({ path: 'originalPost', populate: { path: 'author', select: 'username avatar profile' } })
            .lean();

        res.json({ success: true, items: posts });
    } catch (err) {
        console.error('Hub GET /user/:userId/posts error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

/** GET /api/hub/user/:userId/replies — comments user has written */
router.get('/user/:userId/replies', async (req, res) => {
    try {
        const { userId } = req.params;
        const comments = await HubComment.find({ author: userId })
            .sort({ createdAt: -1 })
            .populate('post', 'content images author topic isRepost originalPost repostedBy createdAt')
            .populate('author', 'username avatar profile phoneNumber')
            .lean();

        res.json({ success: true, items: comments });
    } catch (err) {
        console.error('Hub GET /user/:userId/replies error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// ─── COMMENTS ────────────────────────────────────────────

/** GET /api/hub/posts/:id/comments — Lấy comments */
router.get('/posts/:id/comments', async (req, res) => {
    try {
        const { sort = 'newest' } = req.query;
        const sortOpt = sort === 'top' ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };

        // Only top-level comments (parentComment is null)
        const comments = await HubComment.find({ post: req.params.id, parentComment: null })
            .sort(sortOpt)
            .populate('author', 'username avatar profile phoneNumber')
            .lean();

        // Fetch replies for each comment
        const commentIds = comments.map((c) => c._id);
        const replies = await HubComment.find({ parentComment: { $in: commentIds } })
            .sort({ createdAt: 1 })
            .populate('author', 'username avatar profile phoneNumber')
            .lean();

        // Attach replies
        const repliesMap = {};
        replies.forEach((r) => {
            const pid = r.parentComment.toString();
            if (!repliesMap[pid]) repliesMap[pid] = [];
            repliesMap[pid].push(r);
        });

        const result = comments.map((c) => ({
            ...c,
            replies: repliesMap[c._id.toString()] || [],
        }));

        res.json(result);
    } catch (err) {
        console.error('Hub GET comments error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** POST /api/hub/posts/:id/comments — Tạo comment/reply */
router.post('/posts/:id/comments', requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Không tìm thấy bài' });

        const { content, images, parentComment } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ message: 'Nội dung bình luận không được rỗng' });

        const commentData = {
            post: post._id,
            author: req.userId,
            content: content.trim(),
            images: images || [],
        };

        // If replying to another comment
        if (parentComment) {
            const parent = await HubComment.findById(parentComment);
            if (!parent) return res.status(404).json({ message: 'Comment gốc không tồn tại' });
            commentData.parentComment = parentComment;
            parent.replyCount += 1;
            await parent.save();
        }

        const comment = await HubComment.create(commentData);

        post.commentCount += 1;
        await post.save();

        const populated = await HubComment.findById(comment._id)
            .populate('author', 'username avatar profile phoneNumber')
            .lean();

        res.status(201).json(populated);
    } catch (err) {
        console.error('Hub POST comment error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** POST /api/hub/comments/:id/like — Like comment */
router.post('/comments/:id/like', requireAuth, async (req, res) => {
    try {
        const comment = await HubComment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: 'Không tìm thấy comment' });

        const idx = comment.likes.indexOf(req.userId);
        if (idx === -1) {
            comment.likes.push(req.userId);
        } else {
            comment.likes.splice(idx, 1);
        }
        comment.likeCount = comment.likes.length;
        await comment.save();

        res.json({ liked: idx === -1, likeCount: comment.likeCount });
    } catch (err) {
        console.error('Hub POST comment like error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

/** DELETE /api/hub/comments/:id — Xóa comment */
router.delete('/comments/:id', requireAuth, async (req, res) => {
    try {
        const comment = await HubComment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: 'Không tìm thấy comment' });
        if (comment.author.toString() !== req.userId) return res.status(403).json({ message: 'Không có quyền' });

        // Decrease parent post comment count
        await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

        // If this is a parent comment, also delete its replies
        if (!comment.parentComment) {
            const replyCount = await HubComment.countDocuments({ parentComment: comment._id });
            await HubComment.deleteMany({ parentComment: comment._id });
            await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -replyCount } });
        } else {
            // Decrease parent reply count
            await HubComment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: -1 } });
        }

        await comment.deleteOne();
        res.json({ message: 'Đã xóa bình luận' });
    } catch (err) {
        console.error('Hub DELETE comment error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ─── POLL ─────────────────────────────────────────────────

/** POST /api/hub/posts/:id/vote — Vote poll option */
router.post('/posts/:id/vote', requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post || !post.poll || !post.poll.options?.length) {
            return res.status(404).json({ message: 'Poll không tồn tại' });
        }
        if (post.poll.endsAt && new Date() > post.poll.endsAt) {
            return res.status(400).json({ message: 'Poll đã kết thúc' });
        }

        const { optionIndex } = req.body;
        if (optionIndex == null || optionIndex < 0 || optionIndex >= post.poll.options.length) {
            return res.status(400).json({ message: 'Option không hợp lệ' });
        }

        // Check already voted any option
        const alreadyVoted = post.poll.options.some((o) => o.votes.includes(req.userId));
        if (alreadyVoted) return res.status(400).json({ message: 'Bạn đã vote rồi' });

        post.poll.options[optionIndex].votes.push(req.userId);
        post.poll.options[optionIndex].voteCount += 1;
        post.poll.totalVotes += 1;
        await post.save();

        res.json({ poll: post.poll });
    } catch (err) {
        console.error('Hub POST vote error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ─── TOPICS & TRENDING ───────────────────────────────────

/** GET /api/hub/topics — Danh sách topics */
router.get('/topics', (req, res) => {
    res.json(DEFAULT_TOPICS);
});

/** GET /api/hub/trending — Bài trending */
router.get('/trending', async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 5;

        const posts = await Post.find({ isPublished: true })
            .sort({ likeCount: -1, commentCount: -1, viewCount: -1 })
            .limit(limit)
            .populate('author', 'username avatar profile')
            .lean();

        res.json(posts);
    } catch (err) {
        console.error('Hub GET trending error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ─── UPLOAD ──────────────────────────────────────────────

/** POST /api/hub/upload — Upload ảnh */
router.post('/upload', requireAuth, upload.array('images', 5), (req, res) => {
    try {
        if (!req.files || !req.files.length) {
            return res.status(400).json({ message: 'Không có file nào' });
        }
        const urls = req.files.map((f) => `/uploads/hub/${f.filename}`);
        res.json({ urls });
    } catch (err) {
        console.error('Hub POST upload error:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;

const mongoose = require('mongoose');

const hubCommentSchema = new mongoose.Schema(
    {
        post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true },
        images: [{ type: String }],
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        likeCount: { type: Number, default: 0 },

        // Nested reply
        parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'HubComment', default: null },
        replyCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

hubCommentSchema.index({ post: 1, createdAt: -1 });
hubCommentSchema.index({ parentComment: 1 });

module.exports = mongoose.model('HubComment', hubCommentSchema);

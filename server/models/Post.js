const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    voteCount: { type: Number, default: 0 },
  },
  { _id: true }
);

const postSchema = new mongoose.Schema(
  {
    // Author
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Content
    content: { type: String, default: '' },
    images: [{ type: String }],

    // Topic
    topic: { type: String, default: '' },

    // Interactions
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    repostCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    // Repost
    isRepost: { type: Boolean, default: false },
    originalPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    repostedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Poll
    poll: {
      options: [pollOptionSchema],
      endsAt: { type: Date, default: null },
      totalVotes: { type: Number, default: 0 },
    },

    // Settings
    replyOption: {
      type: String,
      enum: ['anyone', 'followers', 'mentioned'],
      default: 'anyone',
    },

    // Schedule
    scheduledAt: { type: Date, default: null },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ topic: 1, createdAt: -1 });
postSchema.index({ isPublished: 1, scheduledAt: 1 });
postSchema.index({ likeCount: -1 });

module.exports = mongoose.model('Post', postSchema);

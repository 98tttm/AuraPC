const mongoose = require('mongoose');

const supportConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      default: '',
      trim: true,
    },
    lastMessageBy: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    unreadForAdmin: {
      type: Number,
      default: 0,
      min: 0,
    },
    unreadForUser: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true, strict: true }
);

supportConversationSchema.index({ archived: 1, lastMessageAt: -1, updatedAt: -1 });

module.exports = mongoose.model('SupportConversation', supportConversationSchema);

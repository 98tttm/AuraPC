const mongoose = require('mongoose');

const userNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'order_confirmed',
        'order_processing',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
        'order_cancel_approved',
        'order_cancel_rejected',
        'order_return_approved',
        'order_return_rejected',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userNotificationSchema.index({ user: 1, createdAt: -1 });
userNotificationSchema.index({ user: 1, readAt: 1 });

module.exports = mongoose.model('UserNotification', userNotificationSchema);

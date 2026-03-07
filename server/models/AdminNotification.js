const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['order_new', 'order_cancel_request', 'order_return_request', 'order_delivered'],
      required: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
  },
  { timestamps: true }
);

adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ orderNumber: 1, createdAt: -1 });
adminNotificationSchema.index({ readBy: 1, createdAt: -1 });

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);

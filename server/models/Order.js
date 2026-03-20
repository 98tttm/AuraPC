const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
  serialNumber: { type: String, default: null },
});

const requestStateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    reason: { type: String, default: '' },
    requestedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: String,
      phone: String,
      email: String,
      address: String,
      city: String,
      district: String,
      ward: String,
      note: String,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    total: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    appliedPromotion: {
      code: { type: String },
      discountPercent: { type: Number },
      discountAmount: { type: Number },
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'qr', 'momo', 'zalopay', 'atm'],
      default: 'cod',
    },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    zaloPayTransId: { type: String, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelRequest: { type: requestStateSchema, default: () => ({}) },
    returnRequest: { type: requestStateSchema, default: () => ({}) },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, deliveredAt: -1 });
orderSchema.index({ 'cancelRequest.status': 1 });
orderSchema.index({ 'returnRequest.status': 1 });
orderSchema.index({ 'items.serialNumber': 1 });

module.exports = mongoose.model('Order', orderSchema);

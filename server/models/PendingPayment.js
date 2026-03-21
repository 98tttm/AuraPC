const mongoose = require('mongoose');

const pendingPaymentSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  data: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now, expires: 1800 }, // TTL: 30 minutes
});

module.exports = mongoose.model('PendingPayment', pendingPaymentSchema);

const mongoose = require('mongoose');
const crypto = require('crypto');

function generateShareId() {
  return crypto.randomBytes(6).toString('base64url');
}

const builderSchema = new mongoose.Schema(
  {
    shareId: { type: String, unique: true, sparse: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    components: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    auraVisualImage: { type: String, default: null },
  },
  { timestamps: true }
);

builderSchema.pre('save', async function () {
  if (!this.shareId) {
    this.shareId = generateShareId();
  }
});

builderSchema.index({ user: 1 });
builderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL

module.exports = mongoose.model('Builder', builderSchema);

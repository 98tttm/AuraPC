const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema(
    {
        post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        method: { type: String, enum: ['copy_link', 'copy_image', 'embed'], default: 'copy_link' },
    },
    { timestamps: true }
);

shareSchema.index({ post: 1 });

module.exports = mongoose.model('Share', shareSchema);

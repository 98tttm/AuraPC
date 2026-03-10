const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  SupportConversation,
  SupportMessage,
  buildPreview,
  ensureConversationForUser,
  hydrateConversation,
  hydrateMessage,
  listConversationMessages,
  normalizeMessageContent,
  serializeConversation,
  serializeMessage,
} = require('../utils/supportChat');
const { emitSupportConversationUpdated, emitSupportMessageCreated } = require('../socket');

const router = express.Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  try {
    const conversation = await SupportConversation.findOne({ user: req.userId })
      .populate('user', 'phoneNumber email username avatar profile.fullName')
      .populate('assignedAdmin', 'email name avatar role')
      .lean();

    if (!conversation) {
      return res.json({ conversation: null, messages: [] });
    }

    const messages = await listConversationMessages(conversation._id);
    return res.json({
      conversation: serializeConversation(conversation),
      messages,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/me/read', async (req, res) => {
  try {
    const updated = await SupportConversation.findOneAndUpdate(
      { user: req.userId },
      { $set: { unreadForUser: 0 } },
      { new: true }
    )
      .populate('user', 'phoneNumber email username avatar profile.fullName')
      .populate('assignedAdmin', 'email name avatar role')
      .lean();

    if (!updated) {
      return res.json({ success: true, conversation: null });
    }

    const serialized = serializeConversation(updated);
    emitSupportConversationUpdated(serialized);
    return res.json({ success: true, conversation: serialized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/me/messages', async (req, res) => {
  try {
    const content = normalizeMessageContent(req.body?.content);
    if (!content) {
      return res.status(400).json({ error: 'Noi dung tin nhan khong duoc de trong' });
    }

    const conversation = await ensureConversationForUser(req.userId);
    const message = await SupportMessage.create({
      conversation: conversation._id,
      senderType: 'user',
      senderUser: req.userId,
      content,
    });

    await SupportConversation.findByIdAndUpdate(
      conversation._id,
      {
        $set: {
          archived: false,
          lastMessagePreview: buildPreview(content),
          lastMessageBy: 'user',
          lastMessageAt: message.createdAt,
          unreadForUser: 0,
        },
        $inc: { unreadForAdmin: 1 },
      },
      { new: true }
    );

    const [hydratedConversation, hydratedSupportMessage] = await Promise.all([
      hydrateConversation(conversation._id),
      hydrateMessage(message._id),
    ]);

    const serializedConversation = serializeConversation(hydratedConversation);
    const serializedMessage = serializeMessage(hydratedSupportMessage);

    emitSupportConversationUpdated(serializedConversation);
    emitSupportMessageCreated({
      conversation: serializedConversation,
      message: serializedMessage,
    });

    return res.status(201).json({
      conversation: serializedConversation,
      message: serializedMessage,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

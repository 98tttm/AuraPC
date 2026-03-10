const express = require('express');
const { requireAdmin } = require('../../middleware/auth');
const User = require('../../models/User');
const {
  SupportConversation,
  SupportMessage,
  buildPreview,
  escapeRegex,
  hydrateConversation,
  hydrateMessage,
  listConversationMessages,
  normalizeMessageContent,
  serializeConversation,
  serializeMessage,
} = require('../../utils/supportChat');
const { emitSupportConversationUpdated, emitSupportMessageCreated } = require('../../socket');

const router = express.Router();
router.use(requireAdmin);

async function buildCounts() {
  const [open, archived, unread] = await Promise.all([
    SupportConversation.countDocuments({ archived: false }),
    SupportConversation.countDocuments({ archived: true }),
    SupportConversation.countDocuments({ archived: false, unreadForAdmin: { $gt: 0 } }),
  ]);

  return {
    open,
    archived,
    all: open + archived,
    unread,
  };
}

router.get('/', async (req, res) => {
  try {
    const tab = String(req.query.tab || 'open').toLowerCase();
    const search = String(req.query.search || '').trim();
    const filter = {};

    if (tab === 'open') filter.archived = false;
    if (tab === 'archived') filter.archived = true;

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const users = await User.find({
        $or: [
          { phoneNumber: regex },
          { email: regex },
          { username: regex },
          { 'profile.fullName': regex },
        ],
      }).select('_id').lean();

      const userIds = users.map((user) => user._id);
      if (!userIds.length) {
        return res.json({ items: [], counts: await buildCounts() });
      }
      filter.user = { $in: userIds };
    }

    const [items, counts] = await Promise.all([
      SupportConversation.find(filter)
        .populate('user', 'phoneNumber email username avatar profile.fullName')
        .populate('assignedAdmin', 'email name avatar role')
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .limit(200)
        .lean(),
      buildCounts(),
    ]);

    return res.json({
      items: items.map(serializeConversation),
      counts,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:conversationId', async (req, res) => {
  try {
    const conversation = await SupportConversation.findById(req.params.conversationId)
      .populate('user', 'phoneNumber email username avatar profile.fullName')
      .populate('assignedAdmin', 'email name avatar role')
      .lean();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
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

router.put('/:conversationId/read', async (req, res) => {
  try {
    const updated = await SupportConversation.findByIdAndUpdate(
      req.params.conversationId,
      { $set: { unreadForAdmin: 0 } },
      { new: true }
    )
      .populate('user', 'phoneNumber email username avatar profile.fullName')
      .populate('assignedAdmin', 'email name avatar role')
      .lean();

    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const serialized = serializeConversation(updated);
    emitSupportConversationUpdated(serialized);
    return res.json({ success: true, conversation: serialized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:conversationId/archive', async (req, res) => {
  try {
    const archived = req.body?.archived !== false;
    const updated = await SupportConversation.findByIdAndUpdate(
      req.params.conversationId,
      { $set: { archived } },
      { new: true }
    )
      .populate('user', 'phoneNumber email username avatar profile.fullName')
      .populate('assignedAdmin', 'email name avatar role')
      .lean();

    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const serialized = serializeConversation(updated);
    emitSupportConversationUpdated(serialized);
    return res.json({ success: true, conversation: serialized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:conversationId/messages', async (req, res) => {
  try {
    const content = normalizeMessageContent(req.body?.content);
    if (!content) {
      return res.status(400).json({ error: 'Noi dung tin nhan khong duoc de trong' });
    }

    const existingConversation = await SupportConversation.findById(req.params.conversationId);
    if (!existingConversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const message = await SupportMessage.create({
      conversation: existingConversation._id,
      senderType: 'admin',
      senderAdmin: req.adminId,
      content,
    });

    await SupportConversation.findByIdAndUpdate(
      existingConversation._id,
      {
        $set: {
          assignedAdmin: req.adminId,
          archived: false,
          lastMessagePreview: buildPreview(content),
          lastMessageBy: 'admin',
          lastMessageAt: message.createdAt,
          unreadForAdmin: 0,
        },
        $inc: { unreadForUser: 1 },
      },
      { new: true }
    );

    const [hydratedConversation, hydratedSupportMessage] = await Promise.all([
      hydrateConversation(existingConversation._id),
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

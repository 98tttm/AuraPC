const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');

const USER_POPULATE = 'phoneNumber email username avatar profile.fullName';
const ADMIN_POPULATE = 'email name avatar role';

function normalizeMessageContent(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\r\n?/g, '\n').trim().slice(0, 2000);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getUserDisplayName(user) {
  return user?.profile?.fullName?.trim()
    || user?.username?.trim()
    || user?.phoneNumber?.trim()
    || 'Khach hang';
}

function serializeUser(user) {
  if (!user) return null;
  return {
    _id: String(user._id),
    fullName: user.profile?.fullName || '',
    username: user.username || '',
    phoneNumber: user.phoneNumber || '',
    email: user.email || '',
    avatar: user.avatar || '',
    displayName: getUserDisplayName(user),
  };
}

function serializeAdmin(admin) {
  if (!admin) return null;
  return {
    _id: String(admin._id),
    name: admin.name || 'Tu van vien',
    email: admin.email || '',
    avatar: admin.avatar || '',
    role: admin.role || 'admin',
  };
}

function serializeConversation(conversation) {
  if (!conversation) return null;
  return {
    _id: String(conversation._id),
    archived: !!conversation.archived,
    lastMessagePreview: conversation.lastMessagePreview || '',
    lastMessageBy: conversation.lastMessageBy || 'user',
    lastMessageAt: conversation.lastMessageAt || null,
    unreadForAdmin: conversation.unreadForAdmin || 0,
    unreadForUser: conversation.unreadForUser || 0,
    createdAt: conversation.createdAt || null,
    updatedAt: conversation.updatedAt || null,
    user: serializeUser(conversation.user),
    assignedAdmin: serializeAdmin(conversation.assignedAdmin),
  };
}

function serializeMessage(message) {
  if (!message) return null;
  const senderUser = serializeUser(message.senderUser);
  const senderAdmin = serializeAdmin(message.senderAdmin);
  return {
    _id: String(message._id),
    conversationId: String(message.conversation?._id || message.conversation),
    senderType: message.senderType,
    content: message.content || '',
    createdAt: message.createdAt || null,
    updatedAt: message.updatedAt || null,
    sender: message.senderType === 'admin'
      ? {
          _id: senderAdmin?._id || '',
          name: senderAdmin?.name || 'Tu van vien',
          avatar: senderAdmin?.avatar || '',
          role: 'admin',
        }
      : {
          _id: senderUser?._id || '',
          name: senderUser?.displayName || 'Khach hang',
          avatar: senderUser?.avatar || '',
          role: 'user',
        },
  };
}

async function hydrateConversation(conversationId) {
  return SupportConversation.findById(conversationId)
    .populate('user', USER_POPULATE)
    .populate('assignedAdmin', ADMIN_POPULATE)
    .lean();
}

async function hydrateMessage(messageId) {
  return SupportMessage.findById(messageId)
    .populate('senderUser', USER_POPULATE)
    .populate('senderAdmin', ADMIN_POPULATE)
    .lean();
}

async function listConversationMessages(conversationId, limit = 120) {
  const docs = await SupportMessage.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderUser', USER_POPULATE)
    .populate('senderAdmin', ADMIN_POPULATE)
    .lean();
  docs.reverse();
  return docs.map(serializeMessage);
}

async function ensureConversationForUser(userId) {
  let conversation = await SupportConversation.findOne({ user: userId });
  if (conversation) return conversation;

  try {
    conversation = await SupportConversation.create({ user: userId });
    return conversation;
  } catch (err) {
    if (err?.code === 11000) {
      return SupportConversation.findOne({ user: userId });
    }
    throw err;
  }
}

function buildPreview(content) {
  return content.length > 140 ? `${content.slice(0, 137)}...` : content;
}

module.exports = {
  ADMIN_POPULATE,
  USER_POPULATE,
  SupportConversation,
  SupportMessage,
  buildPreview,
  ensureConversationForUser,
  escapeRegex,
  hydrateConversation,
  hydrateMessage,
  listConversationMessages,
  normalizeMessageContent,
  serializeConversation,
  serializeMessage,
};

const UserNotification = require('../models/UserNotification');

/**
 * @param {{ userId: string, type: string, title: string, message: string, metadata?: object }}
 */
async function createUserNotification({ userId, type, title, message, metadata = {} }) {
  if (!userId || !type || !title || !message) return null;
  try {
    return await UserNotification.create({
      user: userId,
      type,
      title,
      message,
      metadata,
    });
  } catch (err) {
    return null;
  }
}

module.exports = { createUserNotification };

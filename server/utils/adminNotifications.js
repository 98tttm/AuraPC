const AdminNotification = require('../models/AdminNotification');

async function createAdminNotification({
  type,
  order,
  orderNumber,
  title,
  message,
  metadata = {},
}) {
  const resolvedOrderId = order && order._id ? order._id : order;
  if (!resolvedOrderId || !orderNumber || !type || !title || !message) return null;
  try {
    return await AdminNotification.create({
      type,
      order: resolvedOrderId,
      orderNumber,
      title,
      message,
      metadata,
    });
  } catch (err) {
    // Notification failures should not block order processing flows.
    return null;
  }
}

module.exports = { createAdminNotification };

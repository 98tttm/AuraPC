const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');
const { buildInvoicePdf } = require('../utils/invoicePdf');
const { getEmailTransporter } = require('../utils/email');
const { createAdminNotification } = require('../utils/adminNotifications');
const { createUserNotification } = require('../utils/userNotifications');
const { emitOrderUpdated } = require('../socket');
const { requireAuth, optionalAuth, requireUserOrAdmin } = require('../middleware/auth');

const router = express.Router();
const DELIVERY_CONFIRM_DELAY_MS = 30 * 60 * 1000;
const ALLOWED_PAYMENT_METHODS = ['cod', 'qr', 'momo', 'zalopay', 'atm'];

function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AP${y}${m}${d}${r}`;
}

function isOrderOwnedByUser(order, userId) {
  if (!order || !order.user || !userId) return false;
  return String(order.user) === String(userId);
}

function canUserConfirmDelivery(order) {
  if (!order || order.status !== 'shipped') return false;
  const baseTime = order.shippedAt || order.updatedAt || order.createdAt;
  if (!baseTime) return false;
  const shippedAt = new Date(baseTime).getTime();
  if (Number.isNaN(shippedAt)) return false;
  return Date.now() - shippedAt >= DELIVERY_CONFIRM_DELAY_MS;
}

function orderAddressFingerprint(shippingAddress = {}) {
  return [
    shippingAddress.fullName,
    shippingAddress.phone,
    shippingAddress.address,
    shippingAddress.ward,
    shippingAddress.district,
    shippingAddress.city,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');
}

function orderItemsFingerprint(items = []) {
  return items
    .map((item) => {
      const productId = item?.product?._id || item?.product || item?.name || '';
      const qty = Math.max(1, Number(item?.qty) || 1);
      const price = Number(item?.price) || 0;
      return `${String(productId)}:${qty}:${price}`;
    })
    .sort()
    .join('|');
}

function buildDuplicateFingerprint({ items, shippingAddress, total, paymentMethod }) {
  return [
    paymentMethod || '',
    Number(total) || 0,
    orderAddressFingerprint(shippingAddress),
    orderItemsFingerprint(items),
  ].join('||');
}

async function findRecentDuplicateOrder({ userId, items, shippingAddress, total, paymentMethod, windowMs = 15 * 60 * 1000 }) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;

  const since = new Date(Date.now() - windowMs);
  const candidates = await Order.find({
    user: new mongoose.Types.ObjectId(userId),
    paymentMethod,
    total: Number(total) || 0,
    status: { $in: ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] },
    createdAt: { $gte: since },
  }).lean();

  const target = buildDuplicateFingerprint({ items, shippingAddress, total, paymentMethod });
  return candidates.find((order) => (
    buildDuplicateFingerprint({
      items: order.items || [],
      shippingAddress: order.shippingAddress || {},
      total: order.total,
      paymentMethod: order.paymentMethod,
    }) === target
  )) || null;
}

/** GET /api/orders?status=... - list orders for logged-in user (optional status filter) */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const status = req.query.status; // optional: pending, shipped, delivered, cancelled, etc.
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const q = { user: userObjectId };
    if (status && status !== 'all') q.status = status;
    const orders = await Order.find(q)
      .sort({ createdAt: -1 })
      .populate('items.product', 'name slug images')
      .lean();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/orders/track/:orderNumber - tra cứu đơn theo mã đơn (không cần đăng nhập), trả về đầy đủ thông tin đơn + product slug/images */
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const orderNumber = (req.params.orderNumber || '').trim().toUpperCase();
    if (!orderNumber) return res.status(400).json({ error: 'Vui lòng nhập mã đơn hàng' });
    const order = await Order.findOne({ orderNumber })
      .populate('items.product', 'name slug images')
      .lean();
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng với mã này' });
    delete order.user;
    if (!Array.isArray(order.items)) order.items = [];
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      shippingFee = 0,
      discount = 0,
      paymentMethod = 'cod',
      isPaid = false,
      user: userId,
      requestInvoice,
      invoiceEmail,
      invoiceType,
      promotionCode,
    } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }

    // === SERVER-SIDE PRICE VERIFICATION ===
    // Query real prices from Product model instead of trusting client
    const productIds = items
      .map(i => i.product)
      .filter(id => id && mongoose.Types.ObjectId.isValid(id));

    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id name price salePrice old_price stock')
      .lean();

    const productMap = new Map();
    products.forEach(p => productMap.set(String(p._id), p));

    // Build verified items with server-side prices + stock check
    const verifiedItems = [];
    for (const item of items) {
      const dbProduct = productMap.get(String(item.product));
      if (!dbProduct) {
        return res.status(400).json({ error: `Sản phẩm không tồn tại: ${item.product}` });
      }
      const qty = Math.max(1, Number(item.qty) || 1);
      const stock = dbProduct.stock ?? 0;
      if (stock === 0) {
        return res.status(400).json({ error: `Sản phẩm "${dbProduct.name}" đã hết hàng.` });
      }
      if (qty > stock) {
        return res.status(400).json({ error: `Sản phẩm "${dbProduct.name}" chỉ còn ${stock} sản phẩm trong kho.` });
      }
      // Use actual DB price (price field = current selling price)
      const verifiedPrice = dbProduct.price ?? 0;
      verifiedItems.push({
        product: item.product,
        name: dbProduct.name || item.name,
        price: verifiedPrice,
        qty,
      });
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: `Invalid paymentMethod. Must be one of: ${ALLOWED_PAYMENT_METHODS.join(', ')}` });
    }

    const paidFlag = isPaid === true || isPaid === 'true' || isPaid === 1 || isPaid === '1';
    const subtotal = verifiedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const resolvedUserId = req.userId || userId;

    // === PROMOTION VALIDATION ===
    let promoDiscount = 0;
    let appliedPromotion = null;
    let validatedPromo = null;
    if (promotionCode) {
      validatedPromo = await Promotion.findOne({ code: promotionCode.toUpperCase().trim(), isActive: true });
      if (!validatedPromo) {
        return res.status(400).json({ error: 'Mã giảm giá không hợp lệ.' });
      }
      const now = new Date();
      if (now < new Date(validatedPromo.startDate) || now > new Date(validatedPromo.endDate)) {
        return res.status(400).json({ error: 'Mã giảm giá đã hết hạn.' });
      }
      if (validatedPromo.maxUsage != null && validatedPromo.usedCount >= validatedPromo.maxUsage) {
        return res.status(400).json({ error: 'Mã giảm giá đã hết lượt sử dụng.' });
      }
      if (subtotal < validatedPromo.minOrderAmount) {
        return res.status(400).json({ error: 'Đơn hàng không đạt giá trị tối thiểu để dùng mã.' });
      }
      if (resolvedUserId && mongoose.Types.ObjectId.isValid(resolvedUserId)) {
        const userUsageCount = await PromotionUsage.countDocuments({ promotion: validatedPromo._id, user: resolvedUserId });
        if (userUsageCount >= validatedPromo.maxUsagePerUser) {
          return res.status(400).json({ error: 'Bạn đã sử dụng mã này đủ số lần.' });
        }
      }
      const rawDiscount = (subtotal * validatedPromo.discountPercent) / 100;
      promoDiscount = Math.round(
        validatedPromo.maxDiscountAmount != null ? Math.min(rawDiscount, validatedPromo.maxDiscountAmount) : rawDiscount
      );
      appliedPromotion = {
        code: validatedPromo.code,
        discountPercent: validatedPromo.discountPercent,
        discountAmount: promoDiscount,
      };
    }

    const totalDiscount = (Number(discount) || 0) + promoDiscount;
    const total = subtotal + (Number(shippingFee) || 0) - totalDiscount;
    const userObjectId = resolvedUserId && mongoose.Types.ObjectId.isValid(resolvedUserId) ? new mongoose.Types.ObjectId(resolvedUserId) : null;
    const duplicateOrder = await findRecentDuplicateOrder({
      userId: resolvedUserId,
      items: verifiedItems,
      shippingAddress: shippingAddress || {},
      total: Math.max(0, total),
      paymentMethod,
    });
    if (duplicateOrder) {
      return res.json({
        _id: duplicateOrder._id,
        orderNumber: duplicateOrder.orderNumber,
        total: duplicateOrder.total,
        deduped: true,
      });
    }

    const order = new Order({
      orderNumber: generateOrderNumber(),
      user: userObjectId,
      items: verifiedItems,
      shippingAddress: shippingAddress || {},
      total: Math.max(0, total),
      shippingFee: Number(shippingFee) || 0,
      discount: totalDiscount,
      appliedPromotion: appliedPromotion || undefined,
      paymentMethod,
      isPaid: paidFlag,
      paidAt: paidFlag ? new Date() : null,
      status: 'pending',
    });
    await order.save();

    // Track promotion usage
    if (validatedPromo && userObjectId) {
      await Promotion.updateOne({ _id: validatedPromo._id }, { $inc: { usedCount: 1 } });
      await PromotionUsage.create({ promotion: validatedPromo._id, user: userObjectId, order: order._id });
    }

    await createAdminNotification({
      type: 'order_new',
      order: order._id,
      orderNumber: order.orderNumber,
      title: 'Có đơn hàng mới',
      message: `Đơn #${order.orderNumber} đang chờ xác nhận`,
      metadata: {
        status: order.status,
        total: order.total,
        isPaid: order.isPaid,
        paymentMethod: order.paymentMethod,
      },
    });

    const userIdNew = order.user && order.user.toString ? order.user.toString() : order.user;
    emitOrderUpdated({ orderNumber: order.orderNumber, status: 'pending', userId: userIdNew || undefined });

    // Gửi hóa đơn điện tử qua email nếu khách yêu cầu
    const shouldSendInvoice = requestInvoice && invoiceEmail && typeof invoiceEmail === 'string' && invoiceEmail.trim().includes('@');
    if (shouldSendInvoice) {
      const emailTo = invoiceEmail.trim();
      try {
        const pdfBuffer = await buildInvoicePdf(order.toObject ? order.toObject() : order, invoiceType === 'company' ? 'company' : 'personal');
        const transporter = getEmailTransporter();
        if (transporter) {
          const fromEmail = process.env.EMAIL_USER || process.env.GMAIL_USER;
          await transporter.sendMail({
            from: `"AuraPC" <${fromEmail}>`,
            to: emailTo,
            subject: `Hóa đơn điện tử đơn hàng #${order.orderNumber} - AuraPC`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:1.25rem;">Cảm ơn bạn đã mua hàng tại AuraPC!</h1>
    <p style="margin:0 0 16px;color:#666;">Xin chào ${(order.shippingAddress && order.shippingAddress.fullName) ? order.shippingAddress.fullName : 'bạn'},</p>
    <p style="margin:0 0 16px;">Đơn hàng của bạn đã được xác nhận thành công.</p>
    <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0 0 8px;"><strong>Thông tin đơn hàng:</strong></p>
      <p style="margin:0 0 4px;">Mã đơn: <strong>#${order.orderNumber}</strong></p>
      <p style="margin:0 0 4px;">Tổng tiền: <strong>${Number(order.total).toLocaleString('vi-VN')}₫</strong></p>
      <p style="margin:0;">Hóa đơn điện tử của bạn được đính kèm trong email này (file PDF).</p>
    </div>
    <p style="margin:24px 0 0;font-size:0.9rem;color:#888;">Trân trọng.<br><strong>AuraPC</strong></p>
  </div>
</body>
</html>
            `,
            attachments: [
              {
                filename: `HoaDon_${order.orderNumber}.pdf`,
                content: pdfBuffer,
              },
            ],
          });
          console.log(`[Orders] Đã gửi hóa đơn PDF đến ${emailTo} cho đơn ${order.orderNumber}`);
        } else {
          console.warn('[Orders] Chưa cấu hình SMTP (EMAIL_USER/EMAIL_PASS). Không gửi được hóa đơn qua email.');
        }
      } catch (emailErr) {
        console.error('[Orders] Lỗi gửi email hóa đơn:', emailErr.message);
        // Không trả lỗi về client - đơn đã tạo thành công, chỉ gửi email thất bại
      }
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/orders/:orderNumber/cancel-request - user requests cancellation while order is being processed */
router.post('/:orderNumber/cancel-request', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order || !isOrderOwnedByUser(order, req.userId)) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({ error: 'Order can only be cancelled while waiting for confirmation/processing' });
    }

    if (order.cancelRequest?.status === 'pending') {
      return res.status(400).json({ error: 'Cancellation request is already pending' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
    order.cancelRequest = {
      status: 'pending',
      reason,
      requestedAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      note: '',
    };

    await order.save();

    await createAdminNotification({
      type: 'order_cancel_request',
      order: order._id,
      orderNumber: order.orderNumber,
      title: 'Yêu cầu hủy đơn',
      message: `Khách hàng yêu cầu hủy đơn #${order.orderNumber}`,
      metadata: { status: order.status, reason },
    });

    const userId = order.user && order.user.toString ? order.user.toString() : order.user;
    emitOrderUpdated({ orderNumber: order.orderNumber, status: order.status, userId: userId || undefined });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/orders/:orderNumber/confirm-received - user confirms order received after shipping window */
router.post('/:orderNumber/confirm-received', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order || !isOrderOwnedByUser(order, req.userId)) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'shipped') {
      return res.status(400).json({ error: 'Order is not in shipped status' });
    }

    if (order.returnRequest?.status === 'pending') {
      return res.status(400).json({ error: 'Cannot confirm delivery while return request is pending' });
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    await order.save();

    const userId = order.user && order.user.toString ? order.user.toString() : order.user;
    if (userId) {
      await createUserNotification({
        userId,
        type: 'order_delivered',
        title: 'Đơn hàng đã giao',
        message: `Đơn #${order.orderNumber} đã được xác nhận đã giao. Bạn có thể vào đơn hàng để đánh giá từng sản phẩm đã mua.`,
        metadata: { orderNumber: order.orderNumber },
      });
    }

    await createAdminNotification({
      type: 'order_delivered',
      order: order._id,
      orderNumber: order.orderNumber,
      title: 'Đơn hàng hoàn tất',
      message: `Khách đã xác nhận nhận hàng đơn #${order.orderNumber}`,
      metadata: { status: 'delivered' },
    });

    emitOrderUpdated({ orderNumber: order.orderNumber, status: 'delivered', userId: userId || undefined });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/orders/:orderNumber/return-request - user requests return/refund after shipping window */
router.post('/:orderNumber/return-request', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order || !isOrderOwnedByUser(order, req.userId)) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'shipped' && order.status !== 'delivered') {
      return res.status(400).json({ error: 'Return request is only available for shipped or delivered orders' });
    }

    if (order.returnRequest?.status === 'pending') {
      return res.status(400).json({ error: 'Return request is already pending' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
    order.returnRequest = {
      status: 'pending',
      reason,
      requestedAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      note: '',
    };
    await order.save();

    await createAdminNotification({
      type: 'order_return_request',
      order: order._id,
      orderNumber: order.orderNumber,
      title: 'Yêu cầu hoàn trả',
      message: `Khách hàng yêu cầu hoàn trả đơn #${order.orderNumber}`,
      metadata: { status: order.status, reason },
    });

    const userIdReturn = order.user && order.user.toString ? order.user.toString() : order.user;
    emitOrderUpdated({ orderNumber: order.orderNumber, status: order.status, userId: userIdReturn || undefined });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:orderNumber', requireUserOrAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('user', 'phoneNumber profile.fullName email avatar')
      .populate('items.product', 'name slug images')
      .lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!req.adminId) {
      if (!order.user || String(order.user._id || order.user) !== String(req.userId)) {
        return res.status(404).json({ error: 'Order not found' });
      }
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

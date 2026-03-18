const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const momoUtils = require('../utils/momo');
const zalopayUtils = require('../utils/zalopay');
const { createAdminNotification } = require('../utils/adminNotifications');
const { buildInvoicePdf } = require('../utils/invoicePdf');
const { getEmailTransporter } = require('../utils/email');

// ── Pending Payments Store ──────────────────────────────────────────
// Order is NOT created until payment is confirmed (callback/IPN/redirect).
// Pending data is stored in memory, keyed by orderNumber.
// Auto-expires after 30 minutes.

const pendingPayments = new Map();
const PENDING_TTL = 30 * 60 * 1000; // 30 min

function storePending(orderNumber, data) {
    pendingPayments.set(orderNumber, { ...data, createdAt: Date.now() });
}

function getPending(orderNumber) {
    const entry = pendingPayments.get(orderNumber);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > PENDING_TTL) {
        pendingPayments.delete(orderNumber);
        return null;
    }
    return entry;
}

function removePending(orderNumber) {
    pendingPayments.delete(orderNumber);
}

// Cleanup expired entries every 10 min
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of pendingPayments) {
        if (now - entry.createdAt > PENDING_TTL) pendingPayments.delete(key);
    }
}, 10 * 60 * 1000);

// ── Helpers ─────────────────────────────────────────────────────────

function generateOrderNumber(prefix = 'MOMO') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = prefix;
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function buildMockPayUrl(orderNumber, paymentMethod) {
    // Prefer FRONTEND_URL for mock mode (redirectUrl may still be localhost)
    let baseRedirect = momoUtils.config.redirectUrl;
    if (baseRedirect.includes('localhost') && process.env.FRONTEND_URL) {
        baseRedirect = `${process.env.FRONTEND_URL.replace(/\/$/, '')}/checkout-momo-return`;
    }
    const url = new URL(baseRedirect);
    const message = paymentMethod === 'atm'
        ? 'Thanh toán ATM MoMo giả lập thành công.'
        : 'Thanh toán MoMo giả lập thành công.';

    url.searchParams.set('resultCode', '0');
    url.searchParams.set('orderId', orderNumber);
    url.searchParams.set('message', message);
    url.searchParams.set('mock', '1');
    return url.toString();
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

async function notifyPaidOrder(order) {
    await createAdminNotification({
        type: 'order_new',
        order: order._id,
        orderNumber: order.orderNumber,
        title: 'Có đơn hàng mới',
        message: `Đơn #${order.orderNumber} đã thanh toán và đang chờ xác nhận`,
        metadata: {
            status: order.status,
            total: order.total,
            isPaid: order.isPaid,
            paymentMethod: order.paymentMethod,
        },
    });
}

/**
 * Validate items, check stock, calculate total.
 * Returns { orderItems, finalTotal, discountAmount } or throws.
 */
async function validateAndBuildItems(items, directDiscount) {
    const productIds = items
        .map((item) => item.product)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    if (productIds.length === 0) {
        throw Object.assign(new Error('No valid product IDs'), { statusCode: 400 });
    }

    const products = await Product.find({ _id: { $in: productIds } })
        .select('_id name price salePrice stock')
        .lean();

    const productMap = new Map();
    products.forEach((p) => productMap.set(String(p._id), p));

    let originalTotal = 0;
    const orderItems = [];

    for (const item of items) {
        const dbProduct = productMap.get(String(item.product));
        if (!dbProduct) {
            throw Object.assign(new Error(`Product not found: ${item.product}`), { statusCode: 400 });
        }
        const qty = Math.max(1, Number(item.qty) || 1);
        const stock = dbProduct.stock ?? 0;
        if (stock === 0) {
            throw Object.assign(new Error(`Sản phẩm "${dbProduct.name}" đã hết hàng.`), { statusCode: 400 });
        }
        if (qty > stock) {
            throw Object.assign(new Error(`Sản phẩm "${dbProduct.name}" chỉ còn ${stock} sản phẩm trong kho.`), { statusCode: 400 });
        }
        const verifiedPrice = dbProduct.salePrice ?? dbProduct.price ?? 0;
        originalTotal += verifiedPrice * qty;
        orderItems.push({
            product: item.product,
            name: dbProduct.name || item.name,
            price: verifiedPrice,
            qty,
        });
    }

    const discountAmount = Number(directDiscount) || 0;
    const finalTotal = Math.max(0, originalTotal - discountAmount);

    return { orderItems, finalTotal, discountAmount };
}

/**
 * Create Order in DB from pending payment data. Returns the saved order.
 */
async function createOrderFromPending(pendingData, { isPaid = true } = {}) {
    const order = new Order({
        orderNumber: pendingData.orderNumber,
        user: pendingData.userId,
        items: pendingData.orderItems,
        total: pendingData.finalTotal,
        discount: pendingData.discountAmount,
        shippingFee: 0,
        shippingAddress: pendingData.shippingAddress,
        paymentMethod: pendingData.paymentMethod,
        isPaid,
        paidAt: isPaid ? new Date() : null,
        status: 'pending',
        zaloPayTransId: pendingData.zaloPayTransId || null,
    });
    await order.save();

    // Gửi hóa đơn điện tử qua email nếu khách yêu cầu
    if (pendingData.requestInvoice && pendingData.invoiceEmail) {
        sendInvoiceEmail(order.toObject ? order.toObject() : order, pendingData.invoiceEmail, pendingData.invoiceType).catch(() => {});
    }

    return order;
}

/**
 * Gửi hóa đơn điện tử qua email (fire-and-forget, không block flow chính)
 */
async function sendInvoiceEmail(order, emailTo, invoiceType = 'personal') {
    const transporter = getEmailTransporter();
    if (!transporter) return;
    const fromEmail = process.env.EMAIL_USER || process.env.GMAIL_USER;
    const pdfBuffer = await buildInvoicePdf(order, invoiceType === 'company' ? 'company' : 'personal');
    await transporter.sendMail({
        from: `"AuraPC" <${fromEmail}>`,
        to: emailTo.trim(),
        subject: `Hóa đơn điện tử đơn hàng #${order.orderNumber} - AuraPC`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="padding:24px;background:#1a1a2e;text-align:center;">
      <span style="font-size:1.4rem;font-weight:800;letter-spacing:3px;color:#fff;">AURA</span><span style="font-size:1.4rem;font-weight:800;letter-spacing:3px;color:#f97316;">PC</span>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 8px;font-size:1.1rem;color:#1a1a2e;">Cảm ơn bạn đã mua hàng tại AuraPC!</h2>
      <p style="color:#666;font-size:0.9rem;">Đơn hàng <strong>#${order.orderNumber}</strong> đã được xác nhận thanh toán.</p>
      <p style="color:#666;font-size:0.9rem;">Hóa đơn điện tử được đính kèm trong email này dưới dạng file PDF.</p>
      <div style="margin:20px 0;padding:16px;background:#f8f9fa;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:0.85rem;color:#666;">Tổng thanh toán:</p>
        <p style="margin:0;font-size:1.25rem;font-weight:700;color:#f97316;">${Number(order.total).toLocaleString('vi-VN')}đ</p>
      </div>
      <p style="color:#999;font-size:0.8rem;">Nếu bạn có thắc mắc, vui lòng liên hệ bộ phận hỗ trợ AuraPC.</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:0.8rem;color:#999;">AuraPC — Gaming PC & Linh kiện chính hãng</p>
    </div>
  </div>
</body>
</html>`,
        attachments: [{
            filename: `HoaDon_${order.orderNumber}.pdf`,
            content: pdfBuffer,
        }],
    });
}

// ── MoMo ────────────────────────────────────────────────────────────

// POST /api/payment/momo/create
// Validates items, calls MoMo API, stores pending. Does NOT create Order yet.
router.post('/momo/create', requireAuth, async (req, res) => {
    let paymentMethod = req.body?.paymentMethod;
    let finalTotal = 0;

    try {
        const userId = req.userId;
        const { items, shippingAddress, directDiscount, requestInvoice, invoiceEmail, invoiceType } = req.body;

        if (!['momo', 'atm'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        if (!items || !items.length) {
            return res.status(400).json({ success: false, message: 'Cart items required' });
        }

        const { orderItems, finalTotal: total, discountAmount } = await validateAndBuildItems(items, directDiscount);
        finalTotal = total;

        const orderNumber = generateOrderNumber('MOMO');

        const duplicateOrder = await findRecentDuplicateOrder({
            userId,
            items: orderItems,
            shippingAddress: shippingAddress || {},
            total: finalTotal,
            paymentMethod,
        });
        if (duplicateOrder) {
            if (momoUtils.config.mockMode) {
                return res.json({
                    success: true,
                    payUrl: buildMockPayUrl(duplicateOrder.orderNumber, paymentMethod),
                    mock: true,
                    deduped: true,
                });
            }

            return res.status(409).json({
                success: false,
                message: `Bạn vừa tạo một đơn tương tự gần đây. Vui lòng kiểm tra đơn #${duplicateOrder.orderNumber}.`,
                orderNumber: duplicateOrder.orderNumber,
                deduped: true,
            });
        }

        const configIssues = momoUtils.getCreateConfigIssues({
            paymentMethod,
            amount: finalTotal,
        });

        if (configIssues.length) {
            return res.status(400).json({
                success: false,
                message: configIssues[0],
                issues: configIssues,
            });
        }

        // Store pending data (order will be created on payment confirmation)
        const pendingData = {
            orderNumber,
            userId,
            orderItems,
            finalTotal,
            discountAmount,
            shippingAddress,
            paymentMethod,
            requestInvoice: !!requestInvoice,
            invoiceEmail: invoiceEmail || '',
            invoiceType: invoiceType || 'personal',
        };

        const requestId = `${orderNumber}_${Date.now()}`;
        const orderInfo = `Thanh toan don hang ${orderNumber} tai AuraPC`;
        const amount = String(finalTotal);
        const requestType = paymentMethod === 'atm' ? 'payWithATM' : 'captureWallet';

        const payload = momoUtils.buildCreatePayload({
            requestId,
            amount,
            orderId: orderNumber,
            orderInfo,
            requestType,
        });

        if (momoUtils.config.mockMode) {
            // Mock mode: create order immediately as paid
            const order = await createOrderFromPending(pendingData, { isPaid: true });
            await notifyPaidOrder(order);

            return res.json({
                success: true,
                payUrl: buildMockPayUrl(orderNumber, paymentMethod),
                mock: true,
            });
        }

        payload.signature = momoUtils.createSignature(payload);

        const momoResponse = await axios.post(momoUtils.config.endpoint, payload, {
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            timeout: 30000,
        });

        if (Number(momoResponse.data?.resultCode) !== 0 || !momoResponse.data?.payUrl) {
            console.error('MoMo Create Error:', momoResponse.data);
            return res.status(400).json({
                success: false,
                message: momoResponse.data?.message || 'MoMo từ chối khởi tạo giao dịch.',
                resultCode: momoResponse.data?.resultCode,
                momo: momoResponse.data,
            });
        }

        // Store pending — order will be created only when IPN/redirect confirms payment
        storePending(orderNumber, pendingData);

        return res.json({ success: true, payUrl: momoResponse.data.payUrl });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        if (error.response?.data) {
            const momoError = error.response.data;
            const issues = momoUtils.getCreateConfigIssues({
                paymentMethod,
                amount: finalTotal,
            });

            if (Number(momoError.resultCode) === 11007) {
                issues.unshift('Chữ ký HMAC không hợp lệ. Hãy kiểm tra MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY có thuộc cùng một merchant sandbox.');
            }

            console.error('MoMo Create Rejected:', momoError);
            return res.status(400).json({
                success: false,
                message: momoError.message || 'MoMo từ chối request tạo thanh toán.',
                resultCode: momoError.resultCode,
                momo: momoError,
                issues,
            });
        }

        console.error('MoMo Create Exception:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo thanh toán MoMo',
            code: error.code || undefined,
        });
    }
});

// POST /api/payment/momo/ipn
// MoMo server-to-server callback. Creates Order if payment succeeded.
router.post('/momo/ipn', async (req, res) => {
    try {
        const data = req.body;

        const isValid = momoUtils.verifyIpnSignature(data);
        if (!isValid) {
            console.error('Invalid MoMo IPN Signature:', data);
            return res.status(400).json({ message: 'Invalid signature' });
        }

        const { orderId, resultCode } = data;

        if (Number(resultCode) === 0) {
            // Check if order already exists (created by redirect confirm)
            const existingOrder = await Order.findOne({ orderNumber: orderId });
            if (existingOrder) {
                if (!existingOrder.isPaid) {
                    existingOrder.isPaid = true;
                    existingOrder.paidAt = new Date();
                    await existingOrder.save();
                    await notifyPaidOrder(existingOrder);
                }
                removePending(orderId);
                console.log(`Order ${orderId} marked as paid from MoMo IPN`);
                return res.status(204).send();
            }

            // Create order from pending data
            const pendingData = getPending(orderId);
            if (pendingData) {
                const order = await createOrderFromPending(pendingData, { isPaid: true });
                await notifyPaidOrder(order);
                removePending(orderId);
                console.log(`Order ${orderId} created and marked as paid from MoMo IPN`);
            } else {
                console.error('MoMo IPN - No pending data for:', orderId);
            }
        } else {
            // Payment failed — just remove pending, no order created
            removePending(orderId);
            console.log(`MoMo IPN: Payment failed for ${orderId}, status ${resultCode}`);
        }

        return res.status(204).send();
    } catch (error) {
        console.error('MoMo IPN Exception:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/payment/momo/confirm
// Called from frontend redirect. Creates order if payment succeeded and IPN hasn't already.
router.get('/momo/confirm', requireAuth, async (req, res) => {
    try {
        const { orderId, resultCode } = req.query;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Missing orderId' });
        }

        // Check if order already exists (created by IPN)
        const existingOrder = await Order.findOne({ orderNumber: orderId });
        if (existingOrder) {
            removePending(orderId);
            return res.json({ success: true, orderNumber: existingOrder.orderNumber, alreadyCreated: true });
        }

        if (String(resultCode) !== '0') {
            removePending(orderId);
            return res.status(400).json({ success: false, message: 'Thanh toán không thành công.' });
        }

        const pendingData = getPending(orderId);
        if (!pendingData) {
            return res.status(404).json({ success: false, message: 'Phiên thanh toán đã hết hạn.' });
        }

        const order = await createOrderFromPending(pendingData, { isPaid: true });
        await notifyPaidOrder(order);
        removePending(orderId);

        return res.json({ success: true, orderNumber: order.orderNumber });
    } catch (error) {
        console.error('MoMo Confirm Exception:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// ── ZaloPay ──────────────────────────────────────────────────────────

// POST /api/payment/zalopay/create
// Validates items, calls ZaloPay API, stores pending. Does NOT create Order yet.
router.post('/zalopay/create', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { items, shippingAddress, directDiscount, requestInvoice, invoiceEmail, invoiceType } = req.body;

        if (!items || !items.length) {
            return res.status(400).json({ success: false, message: 'Cart items required' });
        }

        const { orderItems, finalTotal, discountAmount } = await validateAndBuildItems(items, directDiscount);
        const orderNumber = generateOrderNumber('ZLP');

        // Check for duplicate orders
        const duplicateOrder = await findRecentDuplicateOrder({
            userId,
            items: orderItems,
            shippingAddress: shippingAddress || {},
            total: finalTotal,
            paymentMethod: 'zalopay',
        });
        if (duplicateOrder) {
            return res.status(409).json({
                success: false,
                message: `Bạn vừa tạo một đơn tương tự gần đây. Vui lòng kiểm tra đơn #${duplicateOrder.orderNumber}.`,
                orderNumber: duplicateOrder.orderNumber,
                deduped: true,
            });
        }

        const configIssues = zalopayUtils.getConfigIssues();
        if (configIssues.length) {
            return res.status(400).json({
                success: false,
                message: configIssues[0],
                issues: configIssues,
            });
        }

        // Build ZaloPay create order payload
        const zaloPayload = zalopayUtils.buildCreatePayload({
            orderNumber,
            amount: finalTotal,
            description: `AuraPC - Thanh toan don hang #${orderNumber}`,
            items: orderItems.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
            userId: String(userId),
        });

        // Call ZaloPay API
        const zaloResponse = await axios.post(zalopayUtils.config.endpoint, null, {
            params: zaloPayload,
            timeout: 30000,
        });

        const zaloData = zaloResponse.data;

        if (Number(zaloData.return_code) !== 1 || !zaloData.order_url) {
            console.error('ZaloPay Create Error:', zaloData);
            return res.status(400).json({
                success: false,
                message: zaloData.return_message || 'ZaloPay từ chối khởi tạo giao dịch.',
                returnCode: zaloData.return_code,
                zalopay: zaloData,
            });
        }

        // Store pending — order will be created only when callback/confirm confirms payment
        storePending(orderNumber, {
            orderNumber,
            userId,
            orderItems,
            finalTotal,
            discountAmount,
            shippingAddress,
            paymentMethod: 'zalopay',
            zaloPayTransId: zaloPayload.app_trans_id,
            requestInvoice: !!requestInvoice,
            invoiceEmail: invoiceEmail || '',
            invoiceType: invoiceType || 'personal',
        });

        return res.json({
            success: true,
            orderUrl: zaloData.order_url,
            orderNumber,
            appTransId: zaloPayload.app_trans_id,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        if (error.response?.data) {
            console.error('ZaloPay Create Rejected:', error.response.data);
            return res.status(400).json({
                success: false,
                message: error.response.data.return_message || 'ZaloPay từ chối request tạo thanh toán.',
                zalopay: error.response.data,
            });
        }
        console.error('ZaloPay Create Exception:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo thanh toán ZaloPay',
        });
    }
});

// POST /api/payment/zalopay/callback
// ZaloPay server-to-server callback. Creates Order if payment succeeded.
router.post('/zalopay/callback', async (req, res) => {
    try {
        const { data: dataStr, mac, type } = req.body;

        // Only handle order callbacks (type=1)
        if (type !== 1) {
            return res.json({ return_code: 1, return_message: 'OK' });
        }

        // Verify MAC using key2
        const isValid = zalopayUtils.verifyCallbackMac(dataStr, mac);
        if (!isValid) {
            console.error('Invalid ZaloPay Callback MAC');
            return res.json({ return_code: -1, return_message: 'mac not equal' });
        }

        const callbackData = JSON.parse(dataStr);
        const appTransId = callbackData.app_trans_id;
        const orderNumber = appTransId.split('_').slice(1).join('_');

        // Check if order already exists (created by redirect confirm)
        const existingOrder = await Order.findOne({ orderNumber });
        if (existingOrder) {
            if (!existingOrder.isPaid) {
                existingOrder.isPaid = true;
                existingOrder.paidAt = new Date();
                existingOrder.zaloPayTransId = String(callbackData.zp_trans_id || appTransId);
                await existingOrder.save();
                await notifyPaidOrder(existingOrder);
            }
            removePending(orderNumber);
            return res.json({ return_code: 1, return_message: 'success' });
        }

        // Create order from pending data
        const pendingData = getPending(orderNumber);
        if (pendingData) {
            pendingData.zaloPayTransId = String(callbackData.zp_trans_id || appTransId);
            const order = await createOrderFromPending(pendingData, { isPaid: true });
            await notifyPaidOrder(order);
            removePending(orderNumber);
            console.log(`Order ${orderNumber} created and marked as paid from ZaloPay callback`);
        } else {
            console.error('ZaloPay Callback - No pending data for:', orderNumber);
        }

        return res.json({ return_code: 1, return_message: 'success' });
    } catch (error) {
        console.error('ZaloPay Callback Exception:', error);
        return res.json({ return_code: 0, return_message: 'exception' });
    }
});

// GET /api/payment/zalopay/confirm
// Called from frontend redirect. Creates order if payment succeeded and callback hasn't already.
router.get('/zalopay/confirm', requireAuth, async (req, res) => {
    try {
        const { apptransid, status } = req.query;

        if (!apptransid) {
            return res.status(400).json({ success: false, message: 'Missing apptransid' });
        }

        const orderNumber = apptransid.split('_').slice(1).join('_');

        // Check if order already exists (created by callback)
        const existingOrder = await Order.findOne({ orderNumber });
        if (existingOrder) {
            removePending(orderNumber);
            return res.json({ success: true, orderNumber: existingOrder.orderNumber, alreadyCreated: true });
        }

        if (String(status) !== '1') {
            removePending(orderNumber);
            return res.status(400).json({ success: false, message: 'Thanh toán không thành công.' });
        }

        const pendingData = getPending(orderNumber);
        if (!pendingData) {
            return res.status(404).json({ success: false, message: 'Phiên thanh toán đã hết hạn.' });
        }

        pendingData.zaloPayTransId = apptransid;
        const order = await createOrderFromPending(pendingData, { isPaid: true });
        await notifyPaidOrder(order);
        removePending(orderNumber);

        return res.json({ success: true, orderNumber: order.orderNumber });
    } catch (error) {
        console.error('ZaloPay Confirm Exception:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// POST /api/payment/zalopay/query
// Query ZaloPay order status
router.post('/zalopay/query', requireAuth, async (req, res) => {
    try {
        const { appTransId } = req.body;
        if (!appTransId) {
            return res.status(400).json({ success: false, message: 'appTransId required' });
        }

        const mac = zalopayUtils.createQueryMac(appTransId);
        const queryResponse = await axios.post(zalopayUtils.config.queryEndpoint, null, {
            params: {
                app_id: parseInt(zalopayUtils.config.appId, 10),
                app_trans_id: appTransId,
                mac,
            },
            timeout: 15000,
        });

        return res.json({ success: true, ...queryResponse.data });
    } catch (error) {
        console.error('ZaloPay Query Exception:', error);
        return res.status(500).json({ success: false, message: 'Lỗi truy vấn trạng thái ZaloPay' });
    }
});

module.exports = router;

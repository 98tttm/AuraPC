const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const momoUtils = require('../utils/momo');
const { createAdminNotification } = require('../utils/adminNotifications');

function generateOrderNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'MOMO';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function buildMockPayUrl(orderNumber, paymentMethod) {
    const url = new URL(momoUtils.config.redirectUrl);
    const message = paymentMethod === 'atm'
        ? 'Thanh toán ATM MoMo giả lập thành công.'
        : 'Thanh toán MoMo giả lập thành công.';

    url.searchParams.set('resultCode', '0');
    url.searchParams.set('orderId', orderNumber);
    url.searchParams.set('message', message);
    url.searchParams.set('mock', '1');
    return url.toString();
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

// POST /api/payment/momo/create
// Creates a pending order and generates the MoMo payUrl.
router.post('/momo/create', requireAuth, async (req, res) => {
    let paymentMethod = req.body?.paymentMethod;
    let finalTotal = 0;

    try {
        const userId = req.userId;
        const { items, shippingAddress, directDiscount } = req.body;

        if (!['momo', 'atm'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        if (!items || !items.length) {
            return res.status(400).json({ success: false, message: 'Cart items required' });
        }

        const productIds = items
            .map((item) => item.product)
            .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

        if (productIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid product IDs' });
        }

        const products = await Product.find({ _id: { $in: productIds } })
            .select('_id name price salePrice')
            .lean();

        const productMap = new Map();
        products.forEach((product) => productMap.set(String(product._id), product));

        const orderNumber = generateOrderNumber();
        let originalTotal = 0;
        const orderItems = [];

        for (const item of items) {
            const dbProduct = productMap.get(String(item.product));
            if (!dbProduct) {
                return res.status(400).json({ success: false, message: `Product not found: ${item.product}` });
            }

            const qty = Math.max(1, Number(item.qty) || 1);
            const verifiedPrice = dbProduct.price ?? 0;
            originalTotal += verifiedPrice * qty;

            orderItems.push({
                product: item.product,
                name: dbProduct.name || item.name,
                price: verifiedPrice,
                qty,
            });
        }

        const discountAmount = Number(directDiscount) || 0;
        finalTotal = Math.max(0, originalTotal - discountAmount);

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
            const order = new Order({
                orderNumber,
                user: userId,
                items: orderItems,
                total: finalTotal,
                discount: discountAmount,
                shippingFee: 0,
                shippingAddress,
                paymentMethod,
                isPaid: true,
                paidAt: new Date(),
                status: 'pending',
            });
            await order.save();
            await notifyPaidOrder(order);

            return res.json({
                success: true,
                payUrl: buildMockPayUrl(orderNumber, paymentMethod),
                mock: true,
            });
        }

        payload.signature = momoUtils.createSignature(payload);

        const momoResponse = await axios.post(momoUtils.config.endpoint, payload, {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
            },
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

        const order = new Order({
            orderNumber,
            user: userId,
            items: orderItems,
            total: finalTotal,
            discount: discountAmount,
            shippingFee: 0,
            shippingAddress,
            paymentMethod,
            isPaid: false,
            status: 'pending',
        });
        await order.save();

        return res.json({ success: true, payUrl: momoResponse.data.payUrl });
    } catch (error) {
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
// MoMo server-to-server callback.
router.post('/momo/ipn', async (req, res) => {
    try {
        const data = req.body;

        const isValid = momoUtils.verifyIpnSignature(data);
        if (!isValid) {
            console.error('Invalid MoMo IPN Signature:', data);
            return res.status(400).json({ message: 'Invalid signature' });
        }

        const { orderId, resultCode } = data;
        const order = await Order.findOne({ orderNumber: orderId });

        if (!order) {
            console.error('MoMo IPN - Order not found:', orderId);
            return res.status(404).json({ message: 'Order not found' });
        }

        if (Number(resultCode) === 0) {
            order.isPaid = true;
            order.paidAt = new Date();
            order.status = 'pending';
            await order.save();
            await notifyPaidOrder(order);
            console.log(`Order ${orderId} marked as paid from MoMo IPN`);
        } else {
            console.log(`Order ${orderId} MoMo IPN: Status ${resultCode}`);
        }

        return res.status(204).send();
    } catch (error) {
        console.error('MoMo IPN Exception:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

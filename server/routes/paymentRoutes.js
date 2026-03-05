const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const momoUtils = require('../utils/momo');
const { createAdminNotification } = require('../utils/adminNotifications');

// Generate a random order number
function generateOrderNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'MOMO';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// POST /api/payment/momo/create
// Creates pending order and generates MoMo payUrl
router.post('/momo/create', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { items, shippingAddress, paymentMethod, directDiscount } = req.body;

        if (!['momo', 'atm'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        if (!items || !items.length) {
            return res.status(400).json({ success: false, message: 'Cart items required' });
        }

        // === SERVER-SIDE PRICE VERIFICATION ===
        const productIds = items
            .map(i => i.product)
            .filter(id => id && mongoose.Types.ObjectId.isValid(id));

        if (productIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid product IDs' });
        }

        const products = await Product.find({ _id: { $in: productIds } })
            .select('_id name price salePrice')
            .lean();

        const productMap = new Map();
        products.forEach(p => productMap.set(String(p._id), p));

        const orderNumber = generateOrderNumber();
        let originalTotal = 0;
        const orderItems = [];
        for (const i of items) {
            const dbProduct = productMap.get(String(i.product));
            if (!dbProduct) {
                return res.status(400).json({ success: false, message: `Product not found: ${i.product}` });
            }
            const qty = Math.max(1, Number(i.qty) || 1);
            const verifiedPrice = dbProduct.price ?? 0;
            originalTotal += verifiedPrice * qty;
            orderItems.push({
                product: i.product,
                name: dbProduct.name || i.name,
                price: verifiedPrice,
                qty,
            });
        }

        const discountAmount = Number(directDiscount) || 0;
        const finalTotal = Math.max(0, originalTotal - discountAmount);

        // Save pending order
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

        // Prepare MoMo Payload
        const requestId = orderNumber + '_' + Date.now();
        const orderInfo = `Thanh toan don hang ${orderNumber} tai AuraPC`;
        const amount = String(finalTotal);

        // Select request type based on standard MoMo docs
        const requestType = paymentMethod === 'atm' ? 'payWithATM' : 'captureWallet';

        const payload = {
            partnerCode: momoUtils.config.partnerCode,
            requestId,
            amount,
            orderId: orderNumber,
            orderInfo,
            redirectUrl: momoUtils.config.redirectUrl,
            ipnUrl: momoUtils.config.ipnUrl,
            extraData: '',
            requestType,
            lang: 'vi',
        };

        // Create signature
        payload.signature = momoUtils.createSignature(payload);

        // Make request to MoMo
        const response = await axios.post(momoUtils.config.endpoint, payload);

        if (response.data && response.data.payUrl) {
            return res.json({ success: true, payUrl: response.data.payUrl });
        } else {
            console.error('MoMo Create Error:', response.data);
            return res.status(400).json({ success: false, message: 'Lỗi khởi tạo thanh toán MoMo.' });
        }
    } catch (error) {
        console.error('MoMo Create Exception:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tạo thanh toán MoMo' });
    }
});

// POST /api/payment/momo/ipn
// MoMo Server-to-Server callback
router.post('/momo/ipn', async (req, res) => {
    try {
        const data = req.body;

        // 1. Verify Signature
        const isValid = momoUtils.verifyIpnSignature(data);
        if (!isValid) {
            console.error('Invalid MoMo IPN Signature:', data);
            return res.status(400).json({ message: 'Invalid signature' });
        }

        // 2. Process Result
        const { orderId, resultCode } = data;
        const order = await Order.findOne({ orderNumber: orderId });

        if (!order) {
            console.error('MoMo IPN - Order not found:', orderId);
            return res.status(404).json({ message: 'Order not found' });
        }

        if (Number(resultCode) === 0) {
            // Payment Successful
            order.isPaid = true;
            order.paidAt = new Date();
            order.status = 'pending';
            await order.save();

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
            console.log(`Order ${orderId} marked as paid from MoMo IPN`);
        } else {
            // Payment failed or canceled
            // Do nothing or mark as canceled. For now we just log it.
            console.log(`Order ${orderId} MoMo IPN: Status ${resultCode}`);
        }

        // 3. Return 204 No Content to MoMo as acknowledgment
        return res.status(204).send();
    } catch (error) {
        console.error('MoMo IPN Exception:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

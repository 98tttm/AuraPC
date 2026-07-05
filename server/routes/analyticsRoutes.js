const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Middleware để check admin auth
const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        // Verify admin token (điều chỉnh theo logic auth của bạn)
        const token = authHeader.split(' ')[1];
        // TODO: Verify token với admin collection
        
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
};

// ANONYMIZE user ID bằng hash (một chiều, không reversible)
const hashUserId = (userId) => {
    if (!userId) return null;
    return crypto.createHash('sha256')
        .update(String(userId))
        .digest('hex')
        .substring(0, 16);
};

// GET /api/analytics/ml-training-data
// Trả về data đã anonymize cho ML training
router.get('/ml-training-data', async (req, res) => {
    try {
        // 1. Lấy purchase patterns từ tất cả orders đã hoàn thành
        const orders = await Order.find({ status: 'completed' })
            .select('userId items.categoryId items.productId totalAmount createdAt')
            .lean();

        // 2. Aggregate data theo user
        const userPurchaseMap = {};
        
        orders.forEach(order => {
            const userId = hashUserId(order.userId);
            if (!userId) return;
            
            if (!userPurchaseMap[userId]) {
                userPurchaseMap[userId] = {
                    userId,
                    totalSpent: 0,
                    orderCount: 0,
                    categories: new Set(),
                    products: new Set(),
                    orderValues: [],
                    lastOrderDate: null,
                    firstOrderDate: null
                };
            }
            
            const userData = userPurchaseMap[userId];
            userData.totalSpent += order.totalAmount || 0;
            userData.orderCount += 1;
            userData.orderValues.push(order.totalAmount || 0);
            
            if (order.items) {
                order.items.forEach(item => {
                    if (item.categoryId) userData.categories.add(item.categoryId);
                    if (item.productId) userData.products.add(item.productId);
                });
            }
            
            const orderDate = new Date(order.createdAt);
            if (!userData.lastOrderDate || orderDate > userData.lastOrderDate) {
                userData.lastOrderDate = orderDate;
            }
            if (!userData.firstOrderDate || orderDate < userData.firstOrderDate) {
                userData.firstOrderDate = orderDate;
            }
        });

        // Convert Set to Array
        const purchasePatterns = Object.values(userPurchaseMap).map(p => ({
            userId: p.userId,
            totalSpent: Math.round(p.totalSpent),
            orderCount: p.orderCount,
            avgOrderValue: p.orderCount > 0 ? Math.round(p.totalSpent / p.orderCount) : 0,
            categoryCount: p.categories.size,
            productCount: p.products.size,
            categories: Array.from(p.categories).slice(0, 20),
            products: Array.from(p.products).slice(0, 20),
            lastOrderDaysAgo: p.lastOrderDate ? 
                Math.round((Date.now() - p.lastOrderDate) / (1000 * 60 * 60 * 24)) : 999,
            customerAgeDays: p.firstOrderDate && p.lastOrderDate ?
                Math.round((p.lastOrderDate - p.firstOrderDate) / (1000 * 60 * 60 * 24)) : 0
        }));

        // 3. Tính segment distribution
        const segments = purchasePatterns.reduce((acc, p) => {
            let segment;
            if (p.orderCount === 0) segment = 'new';
            else if (p.avgOrderValue > 15000000) segment = 'high_roller';
            else if (p.totalSpent > 50000000) segment = 'vip';
            else if (p.customerAgeDays > 90) segment = 'loyal';
            else if (p.orderCount >= 3) segment = 'regular';
            else segment = 'occasional';
            acc[segment] = (acc[segment] || 0) + 1;
            return acc;
        }, {});

        // 4. Tính category popularity
        const categoryStats = {};
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    if (item.categoryId) {
                        if (!categoryStats[item.categoryId]) {
                            categoryStats[item.categoryId] = { count: 0, revenue: 0 };
                        }
                        categoryStats[item.categoryId].count += 1;
                        categoryStats[item.categoryId].revenue += (order.totalAmount || 0) / (order.items.length || 1);
                    }
                });
            }
        });

        res.json({
            success: true,
            meta: {
                totalUsers: purchasePatterns.length,
                totalOrders: orders.length,
                segments,
                exportedAt: new Date().toISOString()
            },
            purchasePatterns,
            categoryStats,
            segmentDefinitions: {
                new: 'Chưa mua hoặc mới tạo tài khoản',
                high_roller: 'Giá trị đơn hàng trung bình > 15M',
                vip: 'Tổng chi tiêu > 50M',
                loyal: 'Khách hàng > 90 ngày',
                regular: 'Đã mua >= 3 đơn',
                occasional: 'Mua ít (1-2 đơn)'
            }
        });

    } catch (error) {
        console.error('ML Training Data Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/best-sellers
// Trả về best sellers cho cold start recommendations
router.get('/best-sellers', async (req, res) => {
    try {
        const orders = await Order.find({ status: 'completed' })
            .select('items.productId items.name items.categoryId items.price items.quantity')
            .lean();

        // Aggregate product sales
        const productSales = {};
        
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const productId = String(item.productId);
                    if (!productSales[productId]) {
                        productSales[productId] = {
                            productId,
                            productName: item.name || 'Unknown',
                            categoryId: item.categoryId,
                            soldCount: 0,
                            revenue: 0
                        };
                    }
                    productSales[productId].soldCount += item.quantity || 1;
                    productSales[productId].revenue += (item.price || 0) * (item.quantity || 1);
                });
            }
        });

        const bestSellers = Object.values(productSales)
            .sort((a, b) => b.soldCount - a.soldCount)
            .slice(0, 50)
            .map(p => ({
                ...p,
                revenue: Math.round(p.revenue)
            }));

        res.json({
            success: true,
            count: bestSellers.length,
            bestSellers
        });

    } catch (error) {
        console.error('Best Sellers Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/co-purchases
// Trả về sản phẩm thường được mua cùng nhau
router.get('/co-purchases', async (req, res) => {
    try {
        const orders = await Order.find({ status: 'completed' })
            .select('items.productId')
            .lean();

        // Build co-purchase matrix
        const coPurchaseMap = {};
        
        orders.forEach(order => {
            if (order.items && order.items.length > 1) {
                const productIds = order.items
                    .map(i => String(i.productId))
                    .filter(id => id);
                
                // Create pairs
                for (let i = 0; i < productIds.length; i++) {
                    for (let j = i + 1; j < productIds.length; j++) {
                        const key = [productIds[i], productIds[j]].sort().join('-');
                        coPurchaseMap[key] = (coPurchaseMap[key] || 0) + 1;
                    }
                }
            }
        });

        // Convert to array and sort
        const coPurchases = Object.entries(coPurchaseMap)
            .map(([key, count]) => {
                const [product1, product2] = key.split('-');
                return { product1, product2, count };
            })
            .filter(c => c.count >= 2) // Chỉ lấy các cặp có >= 2 lần mua cùng nhau
            .sort((a, b) => b.count - a.count)
            .slice(0, 100);

        res.json({
            success: true,
            count: coPurchases.length,
            coPurchases
        });

    } catch (error) {
        console.error('Co-purchases Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/category-affinity
// Trả về category affinity matrix (user thích category nào)
router.get('/category-affinity', async (req, res) => {
    try {
        const orders = await Order.find({ status: 'completed' })
            .select('userId items.categoryId')
            .lean();

        // Build user -> categories map
        const userCategories = {};
        
        orders.forEach(order => {
            const userId = hashUserId(order.userId);
            if (!userId) return;
            
            if (!userCategories[userId]) {
                userCategories[userId] = new Set();
            }
            
            if (order.items) {
                order.items.forEach(item => {
                    if (item.categoryId) {
                        userCategories[userId].add(String(item.categoryId));
                    }
                });
            }
        });

        // Build category -> users matrix
        const categoryUsers = {};
        Object.values(userCategories).forEach(categories => {
            categories.forEach(cat => {
                if (!categoryUsers[cat]) {
                    categoryUsers[cat] = new Set();
                }
                Object.keys(userCategories).forEach(userId => {
                    if (userCategories[userId].has(cat)) {
                        categoryUsers[cat].add(userId);
                    }
                });
            });
        });

        // Calculate affinity scores
        const categoryAffinity = Object.entries(categoryUsers).map(([cat1, users1]) => {
            const affinities = Object.entries(categoryUsers)
                .filter(([cat2]) => cat1 !== cat2)
                .map(([cat2, users2]) => {
                    const intersection = new Set([...users1].filter(x => users2.has(x)));
                    const union = new Set([...users1, ...users2]);
                    const jaccard = union.size > 0 ? intersection.size / union.size : 0;
                    return {
                        categoryId: cat2,
                        overlapUsers: intersection.size,
                        affinityScore: Math.round(jaccard * 100) / 100
                    };
                })
                .filter(a => a.overlapUsers >= 3)
                .sort((a, b) => b.affinityScore - a.affinityScore)
                .slice(0, 5);
            
            return {
                categoryId: cat1,
                totalUsers: users1.size,
                topAffinities: affinities
            };
        });

        res.json({
            success: true,
            count: categoryAffinity.length,
            categoryAffinity
        });

    } catch (error) {
        console.error('Category Affinity Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/summary
// Trả về tổng hợp stats cho dashboard
router.get('/summary', async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        // Stats tổng quan
        const totalOrders = await Order.countDocuments({ status: 'completed' });
        const totalUsers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();

        // Revenue
        const totalRevenue = await Order.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        // 30-day stats
        const last30DaysOrders = await Order.countDocuments({
            status: 'completed',
            createdAt: { $gte: thirtyDaysAgo }
        });
        
        const last30DaysRevenue = await Order.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    createdAt: { $gte: thirtyDaysAgo }
                } 
            },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        // Orders trend (7 ngày gần nhất)
        const ordersTrend = await Order.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    createdAt: { $gte: sevenDaysAgo }
                } 
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Top categories
        const topCategories = await Order.aggregate([
            { $match: { status: 'completed' } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.categoryId',
                    count: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            stats: {
                totalOrders,
                totalUsers,
                totalProducts,
                totalRevenue: totalRevenue[0]?.total || 0,
                last30DaysOrders,
                last30DaysRevenue: last30DaysRevenue[0]?.total || 0
            },
            ordersTrend,
            topCategories
        });

    } catch (error) {
        console.error('Summary Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

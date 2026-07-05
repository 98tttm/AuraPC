const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const User = require('../models/User');

// BUDGET TIERS (VNĐ)
const BUDGET_TIERS = {
    NEW: {
        name: 'new',
        label: 'Khách Mới',
        minSpent: 0,
        maxSpent: 0,
        color: '#9CA3AF', // Gray
        description: 'Mới tham gia, chưa có lịch sử mua hàng',
        recommendations: ['Sản phẩm bán chạy', 'Ưu đãi mới', 'Combo tiết kiệm']
    },
    BUDGET: {
        name: 'budget',
        label: 'Khách Tiết Kiệm',
        minSpent: 1,
        maxSpent: 5000000, // 5 triệu
        color: '#10B981', // Green
        description: 'Chi tiêu dưới 5 triệu VNĐ',
        recommendations: ['Sản phẩm giá rẻ', 'Khuyến mãi', 'Trả góp 0%']
    },
    STANDARD: {
        name: 'standard',
        label: 'Khách Tiêu Chuẩn',
        minSpent: 5000000, // 5 triệu
        maxSpent: 20000000, // 20 triệu
        color: '#3B82F6', // Blue
        description: 'Chi tiêu từ 5-20 triệu VNĐ',
        recommendations: ['Sản phẩm phổ thông', 'Bộ PC cơ bản', 'Laptop văn phòng']
    },
    PREMIUM: {
        name: 'premium',
        label: 'Khách Cao Cấp',
        minSpent: 20000000, // 20 triệu
        maxSpent: 50000000, // 50 triệu
        color: '#8B5CF6', // Purple
        description: 'Chi tiêu từ 20-50 triệu VNĐ',
        recommendations: ['Laptop gaming', 'PC mid-range', 'Màn hình chuyên dụng']
    },
    VIP: {
        name: 'vip',
        label: 'Khách VIP',
        minSpent: 50000000, // 50 triệu
        maxSpent: Infinity,
        color: '#F59E0B', // Gold
        description: 'Chi tiêu trên 50 triệu VNĐ',
        recommendations: ['PC cao cấp', 'Laptop workstation', 'Build custom RGB', 'Hỗ trợ 24/7']
    }
};

// ANONYMIZE user ID
const hashUserId = (userId) => {
    if (!userId) return null;
    return crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 16);
};

// Get tier by total spent
const getTierBySpent = (spent) => {
    for (const tier of Object.values(BUDGET_TIERS)) {
        if (spent >= tier.minSpent && spent < tier.maxSpent) {
            return tier;
        }
    }
    return BUDGET_TIERS.STANDARD;
};

// GET /api/analytics/user-segment?userId=xxx
// Trả về segment của 1 user cụ thể
router.get('/user-segment', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId required' });
        }

        // Calculate total spent from delivered orders
        const totalSpent = await Order.aggregate([
            { $match: { user: userId, status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        const spent = totalSpent[0]?.total || 0;
        const tier = getTierBySpent(spent);
        
        // Get additional stats
        const orderStats = await Order.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    avgOrderValue: { $avg: '$total' },
                    maxOrderValue: { $max: '$total' },
                    firstOrderDate: { $min: '$createdAt' },
                    lastOrderDate: { $max: '$createdAt' }
                }
            }
        ]);

        const stats = orderStats[0] || {};
        const daysSinceFirstOrder = stats.firstOrderDate 
            ? Math.round((Date.now() - new Date(stats.firstOrderDate)) / (1000 * 60 * 60 * 24))
            : 0;

        res.json({
            success: true,
            userId: hashUserId(userId),
            tier: {
                ...tier,
                totalSpent: spent,
                tierName: tier.label,
                tierColor: tier.color
            },
            stats: {
                totalOrders: stats.totalOrders || 0,
                avgOrderValue: Math.round(stats.avgOrderValue || 0),
                maxOrderValue: stats.maxOrderValue || 0,
                firstOrderDate: stats.firstOrderDate,
                lastOrderDate: stats.lastOrderDate,
                daysSinceFirstOrder
            },
            nextTier: getNextTier(tier.name, spent),
            recommendations: getRecommendationsForTier(tier.name, spent)
        });

    } catch (error) {
        console.error('User Segment Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/segments-distribution
// Trả về phân bố các segment trong hệ thống
router.get('/segments-distribution', async (req, res) => {
    try {
        const distribution = {};
        
        for (const tier of Object.values(BUDGET_TIERS)) {
            distribution[tier.name] = {
                ...tier,
                count: 0,
                revenue: 0,
                avgSpent: 0
            };
        }

        // Get all delivered orders grouped by user
        const userOrders = await Order.aggregate([
            { $match: { status: 'delivered' } },
            {
                $group: {
                    _id: '$user',
                    totalSpent: { $sum: '$total' },
                    orderCount: { $sum: 1 }
                }
            }
        ]);

        // Count users in each tier
        userOrders.forEach(order => {
            const tier = getTierBySpent(order.totalSpent);
            distribution[tier.name].count++;
            distribution[tier.name].revenue += order.totalSpent;
        });

        // Calculate averages
        Object.values(distribution).forEach(d => {
            d.avgSpent = d.count > 0 ? Math.round(d.revenue / d.count) : 0;
        });

        // Add new users (registered but no orders)
        const totalUsersWithOrders = userOrders.length;
        const totalUsers = await User.countDocuments();
        distribution[BUDGET_TIERS.NEW.name].count = totalUsers - totalUsersWithOrders;

        res.json({
            success: true,
            totalUsers,
            totalUsersWithOrders,
            distribution: Object.values(distribution)
        });

    } catch (error) {
        console.error('Segments Distribution Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/tier-recommendations
// Trả về recommendations dựa trên tier
router.get('/tier-recommendations', async (req, res) => {
    try {
        const { tier } = req.query;
        const tierInfo = BUDGET_TIERS[tier?.toUpperCase()] || BUDGET_TIERS.STANDARD;

        res.json({
            success: true,
            tier: tierInfo.name,
            recommendations: getRecommendationsForTier(tierInfo.name, 0)
        });

    } catch (error) {
        console.error('Tier Recommendations Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/personalized-products
// Trả về products phù hợp với tier của user
router.get('/personalized-products', async (req, res) => {
    try {
        const { tier, limit = 20 } = req.query;
        const tierInfo = BUDGET_TIERS[tier?.toUpperCase()] || BUDGET_TIERS.STANDARD;
        
        // Get price range based on tier
        let minPrice = tierInfo.minSpent * 0.3; // Start at 30% of tier min
        let maxPrice = tierInfo.maxSpent === Infinity 
            ? tierInfo.minSpent * 3 // 3x for VIP
            : tierInfo.maxSpent * 1.2; // 120% for others

        // Get best sellers in price range
        const products = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $unwind: '$items' },
            {
                $match: {
                    'items.price': { $gte: minPrice, $lte: maxPrice }
                }
            },
            {
                $group: {
                    _id: '$items.product',
                    productName: { $first: '$items.name' },
                    soldCount: { $sum: '$items.qty' },
                    avgPrice: { $avg: '$items.price' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } }
                }
            },
            { $sort: { soldCount: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            success: true,
            tier: tierInfo.name,
            priceRange: { min: minPrice, max: maxPrice },
            products: products.map(p => ({
                productId: p._id,
                name: p.productName,
                soldCount: p.soldCount,
                avgPrice: Math.round(p.avgPrice),
                revenue: Math.round(p.revenue)
            }))
        });

    } catch (error) {
        console.error('Personalized Products Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper functions
function getNextTier(currentTier, currentSpent) {
    const tierOrder = ['new', 'budget', 'standard', 'premium', 'vip'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex === -1 || currentIndex === tierOrder.length - 1) {
        return null;
    }

    const nextTier = BUDGET_TIERS[tierOrder[currentIndex + 1]];
    const amountNeeded = nextTier.minSpent - currentSpent;
    
    return {
        tier: nextTier.name,
        label: nextTier.label,
        amountNeeded: Math.max(0, amountNeeded),
        color: nextTier.color
    };
}

function getRecommendationsForTier(tierName, spent) {
    const baseRecs = BUDGET_TIERS[tierName.toUpperCase()]?.recommendations || [];
    
    // Add personalized recommendations based on spending
    const personalizedRecs = [];
    
    if (spent > 0 && spent < 5000000) {
        personalizedRecs.push('Gói trả góp 0% lãi suất');
        personalizedRecs.push('Thẻ thành viên giảm 5%');
    } else if (spent >= 5000000 && spent < 20000000) {
        personalizedRecs.push('Tích điểm đổi quà');
        personalizedRecs.push('Ưu đãi sinh nhật 10%');
    } else if (spent >= 20000000 && spent < 50000000) {
        personalizedRecs.push('Hỗ trợ kỹ thuật ưu tiên');
        personalizedRecs.push('Bảo hành 24 tháng');
    } else if (spent >= 50000000) {
        personalizedRecs.push('Account manager riêng');
        personalizedRecs.push('Giao hàng nhanh 2h');
        personalizedRecs.push('Ưu đãi upgrade đặc biệt');
    }
    
    return [...baseRecs, ...personalizedRecs];
}

module.exports = router;

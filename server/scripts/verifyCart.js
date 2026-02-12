require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const User = require('../models/User');

async function verifyCartSetup() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if Cart collection exists
        const collections = await mongoose.connection.db.listCollections().toArray();
        const cartCollectionExists = collections.some(col => col.name === 'carts');
        console.log(`📦 Cart collection exists: ${cartCollectionExists}`);

        // Get all users
        const users = await User.find({});
        console.log(`👥 Found ${users.length} users in database`);

        // Check cart status for each user
        for (const user of users) {
            const cart = await Cart.findOne({ user: user._id }).populate('items.product');
            if (cart) {
                console.log(`  ✅ User ${user.phone || user._id} has cart with ${cart.items.length} items`);
            } else {
                console.log(`  ⚠️  User ${user.phone || user._id} has NO cart`);
                // Create empty cart for this user
                const newCart = new Cart({ user: user._id, items: [] });
                await newCart.save();
                console.log(`  ✨ Created empty cart for user ${user.phone || user._id}`);
            }
        }

        console.log('\n✅ Cart verification complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyCartSetup();

require('dotenv').config();
const mongoose = require('mongoose');

async function cleanupCart() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const cartsCollection = db.collection('carts');

        // Get all carts
        const carts = await cartsCollection.find({}).toArray();
        console.log(`\n🛒 Found ${carts.length} cart(s) to clean\n`);

        for (const cart of carts) {
            console.log(`Processing cart ${cart._id} for user ${cart.user}...`);

            // Merge duplicate products
            const mergedItems = {};

            for (const item of cart.items) {
                const productId = item.product.toString();

                if (mergedItems[productId]) {
                    // Product already exists, add to quantity
                    mergedItems[productId].quantity += item.quantity;
                } else {
                    // New product
                    mergedItems[productId] = {
                        product: item.product,
                        quantity: item.quantity
                    };
                }
            }

            // Convert back to array
            const cleanedItems = Object.values(mergedItems);

            console.log(`  Before: ${cart.items.length} items`);
            console.log(`  After: ${cleanedItems.length} items`);

            // Update cart
            await cartsCollection.updateOne(
                { _id: cart._id },
                { $set: { items: cleanedItems } }
            );

            console.log(`  ✅ Cart cleaned!\n`);
        }

        console.log('✅ All carts cleaned successfully!');
        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

cleanupCart();

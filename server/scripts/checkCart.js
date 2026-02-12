require('dotenv').config();
const mongoose = require('mongoose');

async function checkCart() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📦 Collections in database:');
        collections.forEach(col => {
            console.log(`  - ${col.name}`);
        });

        // Check if carts collection exists and count documents
        if (collections.some(c => c.name === 'carts')) {
            const cartCount = await db.collection('carts').countDocuments();
            console.log(`\n🛒 Total carts in database: ${cartCount}`);

            if (cartCount > 0) {
                const sampleCarts = await db.collection('carts').find({}).limit(3).toArray();
                console.log('\n📋 Sample carts:');
                sampleCarts.forEach((cart, i) => {
                    console.log(`  Cart ${i + 1}:`, JSON.stringify(cart, null, 2));
                });
            }
        } else {
            console.log('\n⚠️  No "carts" collection found!');
        }

        await mongoose.connection.close();
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkCart();

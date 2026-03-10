const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const out = [];
    const log = (msg) => { out.push(msg); console.log(msg); };

    // Count products
    const total = await db.collection('products').countDocuments({});
    const active = await db.collection('products').countDocuments({ active: true });
    const noActive = await db.collection('products').countDocuments({ active: { $exists: false } });
    log(`Total products: ${total}`);
    log(`Active products (active=true): ${active}`);
    log(`Products without active field: ${noActive}`);

    // List categories  
    const cats = await db.collection('categories').find({}).toArray();
    log(`\nCategories (${cats.length}):`);
    for (const c of cats) {
        const count = await db.collection('products').countDocuments({ primaryCategoryId: c._id });
        const countStr = await db.collection('products').countDocuments({ primaryCategoryId: String(c._id) });
        log(`  [${c.name}] | primaryCat(ObjectId): ${count} | primaryCat(String): ${countStr}`);
    }

    // Products with no primaryCategoryId
    const noCat = await db.collection('products').countDocuments({ primaryCategoryId: null });
    const noCat2 = await db.collection('products').countDocuments({ primaryCategoryId: { $exists: false } });
    log(`\nNull primaryCategoryId: ${noCat}`);
    log(`Missing primaryCategoryId: ${noCat2}`);

    // Sample one product to see structure
    const sample = await db.collection('products').findOne({});
    log(`\nSample product keys: ${Object.keys(sample).join(', ')}`);
    log(`Sample primaryCategoryId type: ${typeof sample.primaryCategoryId} = ${sample.primaryCategoryId}`);
    log(`Sample active: ${sample.active}`);
    log(`Sample categoryIds: ${JSON.stringify(sample.categoryIds)}`);

    // CPU products
    const cpus = await db.collection('products').find(
        { name: { $regex: 'CPU Intel|CPU AMD|Core i3|Core i5|Core i7|Core i9|Ryzen', $options: 'i' } }
    ).project({ name: 1, primaryCategoryId: 1, active: 1, featured: 1 }).toArray();
    log(`\nCPU products: ${cpus.length}`);
    cpus.slice(0, 10).forEach(p => log(`  - ${p.name} | active:${p.active} | featured:${p.featured}`));

    // What the current getProductCatalog sees
    // It first tries active=true, then falls back to all
    const activeProds = await db.collection('products').find({ active: true }).count();
    log(`\nProducts with active=true: ${activeProds}`);
    if (activeProds === 0) {
        log('→ Catalog falls back to ALL products (no active filter)');
    }

    // Count all products sorted the same way  
    const allSorted = await db.collection('products').find({})
        .sort({ featured: -1, createdAt: -1 })
        .limit(200)
        .project({ name: 1 })
        .toArray();
    const cpuInFirst200 = allSorted.filter(p => /CPU|Core i|Ryzen/i.test(p.name) && !/Tản nhiệt/i.test(p.name));
    log(`\nProducts in first 200 (all, sorted by featured+createdAt):`);
    log(`  CPU products found: ${cpuInFirst200.length}`);
    cpuInFirst200.forEach(p => log(`    - ${p.name}`));

    // Write results
    require('fs').writeFileSync('C:\\Users\\FPT\\AppData\\Local\\Temp\\catalog_analysis.txt', out.join('\n'), 'utf8');

    process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });

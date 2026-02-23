/**
 * Script: Cập nhật trường brand cho sản phẩm thiếu hoặc đang là "Khác".
 * Trích xuất brand từ tên sản phẩm dựa trên danh sách thương hiệu đã biết.
 *
 * Chạy: node server/scripts/update-brands.js
 * Hoặc: cd server && node scripts/update-brands.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { extractBrandFromName } = require('../utils/brandExtract');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error('Thiếu MONGODB_URI trong .env');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Đã kết nối MongoDB');

  const products = await Product.find({}).select('_id name brand slug').lean();
  console.log(`Tổng sản phẩm: ${products.length}`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of products) {
    const currentBrand = (p.brand || '').trim();
    const shouldUpdate = !currentBrand || currentBrand === 'Khác' || currentBrand.toLowerCase() === 'other';

    if (!shouldUpdate) {
      skipped++;
      continue;
    }

    const extracted = extractBrandFromName(p.name);
    if (extracted) {
      try {
        await Product.updateOne({ _id: p._id }, { $set: { brand: extracted } });
        updated++;
        console.log(`  ✓ ${p.slug}: "${p.name}" → brand: ${extracted}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${p.slug}:`, err.message);
      }
    } else {
      skipped++;
    }
  }

  console.log('\n--- Kết quả ---');
  console.log(`Đã cập nhật: ${updated}`);
  console.log(`Bỏ qua (đã có brand hoặc không nhận dạng): ${skipped}`);
  console.log(`Lỗi: ${failed}`);

  await mongoose.disconnect();
  console.log('Đã ngắt kết nối.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

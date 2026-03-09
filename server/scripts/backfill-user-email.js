require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

async function backfillUserEmail() {
  await connectDB();

  const result = await User.updateMany(
    {
      $or: [
        { email: { $exists: false } },
        { email: null },
      ],
    },
    {
      $set: { email: '' },
    }
  );

  console.log(`Matched: ${result.matchedCount ?? 0}`);
  console.log(`Modified: ${result.modifiedCount ?? 0}`);

  await mongoose.disconnect();
}

backfillUserEmail().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});

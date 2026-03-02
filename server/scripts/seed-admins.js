require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const connectDB = require('../config/database');

const admins = [
  { email: 'thinhtt234111e@st.uel.edu.vn', name: 'Thinh Tran', password: '0' },
  { email: 'phatht234111e@st.uel.edu.vn', name: 'Phat Ho', password: '0' },
  { email: 'thongnt234111e@st.uel.edu.vn', name: 'Thong Nguyen', password: '0' },
  { email: 'nhilhq234111e@st.uel.edu.vn', name: 'Nhi Le', password: '0' },
  { email: 'antt234111e@st.uel.edu.vn', name: 'An Tran', password: '0' },
];

async function seed() {
  await connectDB();

  for (const data of admins) {
    const exists = await Admin.findOne({ email: data.email });
    if (exists) {
      console.log(`SKIP  ${data.email} (already exists)`);
      continue;
    }
    const admin = new Admin(data);
    await admin.save();
    console.log(`CREATED  ${data.email}`);
  }

  console.log('\nDone! All admins seeded.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

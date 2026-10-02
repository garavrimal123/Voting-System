// Run ONCE, manually, from the command line: npm run seed:admin
// This is intentionally the only code path in the entire system that
// creates an Admin document. There is no HTTP endpoint for it.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

(async () => {
  await connectDB();

  const existing = await Admin.findOne();
  if (existing) {
    console.log('An admin account already exists. Aborting — only one admin is allowed.');
    process.exit(0);
  }

  const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.create({ username, passwordHash });
  console.log(`Admin account created for "${username}". Remove BOOTSTRAP_ADMIN_PASSWORD from .env now.`);
  process.exit(0);
})();

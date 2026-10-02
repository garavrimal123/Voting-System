const mongoose = require('mongoose');

// Only ONE admin document will ever exist in this collection.
// It is created exclusively by seed/createAdmin.js — there is no
// registration endpoint that can create an admin account.
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);

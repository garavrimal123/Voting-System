const crypto = require('crypto');

// Voter ID format: WARD-DISTRICT_CODE-#####  e.g. NPV-2026-000482
// Kept simple and sequential-looking but not guessable (random tail).
function generateVoterId() {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(100000, 999999);
  return `NPV-${year}-${random}`;
}

// Given to every applicant immediately at registration, before any
// admin review — used to track status (pending / approved / rejected).
function generateApplicationId() {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(100000, 999999);
  return `APP-${year}-${random}`;
}

// System-generated temporary password: must be changed on first login.
// 10 chars, mixed case + digit + symbol, no ambiguous characters.
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < 10; i++) {
    pwd += chars[crypto.randomInt(0, chars.length)];
  }
  return pwd;
}

// Same pattern as generateApplicationId, used for other trackable requests
// (e.g. voter-submitted detail correction requests).
function generateTrackingId(prefix) {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(100000, 999999);
  return `${prefix}-${year}-${random}`;
}

module.exports = { generateVoterId, generateTempPassword, generateApplicationId, generateTrackingId };

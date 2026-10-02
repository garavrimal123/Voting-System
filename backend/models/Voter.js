const mongoose = require('mongoose');

const voterSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },

  province: { type: String, required: true },
  district: { type: String, required: true },
  municipality: { type: String, required: true },
  ward: { type: Number, required: true },

  // Public tracking ID, given to the applicant at registration, before
  // any admin action. Separate from voterId (which only exists after approval).
  applicationId: { type: String, unique: true, required: true },

  citizenshipNumber: { type: String, required: true, unique: true },
  citizenshipDocUrl: { type: String, required: true }, // Cloudinary URL
  photoUrl: { type: String, required: true },           // Cloudinary URL

  registrationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  rejectionReason: { type: String },

  // Assigned by admin only after manual verification
  voterId: { type: String, unique: true, sparse: true },
  passwordHash: { type: String },
  mustChangePassword: { type: Boolean, default: true },

  // Login rate-limiting: after too many wrong passwords, lock the account
  // for a cooldown period rather than allowing unlimited guesses.
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

  // Password reset via OTP emailed to the address on file. otpHash keeps
  // the OTP itself out of the database in plain form.
  resetOtpHash: { type: String },
  resetOtpExpires: { type: Date },
  // Wrong guesses against the current reset code. After 5 the code is
  // discarded, so a 6-digit code can't be brute-forced within its lifetime.
  resetOtpAttempts: { type: Number, default: 0 },

  // OTP verification specifically for a pending "update my details" request
  // that changes email and/or phone. Separate from resetOtp so a password
  // reset in progress never interferes with a profile-update OTP.
  updateOtpHash: { type: String },
  updateOtpExpires: { type: Date },
  updateOtpAttempts: { type: Number, default: 0 },
  updateOtpVerifiedAt: { type: Date },

  // Tracks WHICH elections this voter has participated in — never WHAT
  // they voted for. This is the only anti-double-voting record.
  votedElections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Election' }],

}, { timestamps: true });

module.exports = mongoose.model('Voter', voterSchema);

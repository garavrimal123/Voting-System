const mongoose = require('mongoose');

// A logged-in, already-approved voter can request a correction to their
// details (spelling mistakes, changed phone, etc). This does NOT change
// the live Voter record directly — it queues a request for an admin to
// review, the same way registration itself is reviewed. Keeps a single
// consistent "someone checked this" guarantee for all voter data changes.
const voterUpdateRequestSchema = new mongoose.Schema({
  voter: { type: mongoose.Schema.Types.ObjectId, ref: 'Voter', required: true },

  // Public tracking ID, separate from the original applicationId, given
  // to the voter immediately so they can check on this specific request.
  trackingId: { type: String, unique: true, required: true },

  changes: {
    fullName: String,
    phone: String,
    email: String,
    province: String,
    district: String,
    municipality: String,
    ward: Number,
    citizenshipNumber: String,
  },
  newCitizenshipDocUrl: String, // only set if the voter re-uploaded
  newPhotoUrl: String,          // only set if the voter re-uploaded

  // Required when changing fullName, province, district, municipality, or
  // ward — proof the new information is correct (e.g. citizenship copy,
  // marriage certificate, ward recommendation letter). Not required for
  // photo, citizenship document, email, or phone changes (those are their
  // own proof, or verified by OTP instead).
  proofDocUrl: String,

  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewReason: { type: String },

}, { timestamps: true });

module.exports = mongoose.model('VoterUpdateRequest', voterUpdateRequestSchema);

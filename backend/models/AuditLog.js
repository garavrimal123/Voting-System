const mongoose = require('mongoose');

// Records every meaningful admin action for accountability — who did what,
// to what, and when. Never records the CONTENT of a vote (that would break
// anonymity) — only actions on registrations, elections, and candidates.
//
// Actions taken by the system itself (e.g. an election closing automatically
// when its end time passes) are recorded too, with adminUsername 'system'.
const auditLogSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  adminUsername: { type: String, default: 'system' }, // denormalized so the log still reads fine if the admin doc changes
  action: { type: String, required: true }, // e.g. 'approve_registration', 'open_election'
  targetType: { type: String }, // 'Voter', 'Election', 'Candidate', 'VoterUpdateRequest'
  targetId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: String }, // short human-readable summary
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);

const mongoose = require('mongoose');

// CRITICAL: this collection intentionally has NO reference to any voter,
// hashed or otherwise. It is the anonymous ballot box. Do not add a
// voterId field here — that would break vote confidentiality.
const voteRecordSchema = new mongoose.Schema({
  election: { type: mongoose.Schema.Types.ObjectId, ref: 'Election', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  castAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('VoteRecord', voteRecordSchema);

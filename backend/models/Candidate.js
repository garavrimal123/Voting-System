const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  election: { type: mongoose.Schema.Types.ObjectId, ref: 'Election', required: true },
  name: { type: String, required: true },
  party: { type: String, required: true },
  photoUrl: { type: String },      // candidate photo
  symbolUrl: { type: String },     // party election symbol
}, { timestamps: true });

module.exports = mongoose.model('Candidate', candidateSchema);

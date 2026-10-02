const mongoose = require('mongoose');

// One Election = one contest for one seat.
// scope 'local': tied to one province/district/municipality(/ward) — e.g.
//   "Mayor - Biratnagar Metropolitan City".
// scope 'national': open to every approved voter nationwide regardless of
//   location — e.g. a Prime Minister / federal-level election. Location
//   fields are left empty for these.
const electionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  scope: { type: String, enum: ['local', 'national'], default: 'local', required: true },
  level: {
    type: String,
    enum: ['mayor', 'deputy_mayor', 'ward_chairperson', 'ward_member', 'prime_minister', 'president'],
    required: true,
  },
  // Required only when scope is 'local' — enforced in the controller,
  // since Mongoose's built-in `required` can't easily depend on scope.
  province: { type: String },
  district: { type: String },
  municipality: { type: String },
  ward: { type: Number }, // only relevant for ward-level contests

  status: {
    type: String,
    enum: ['draft', 'scheduled', 'open', 'closed'],
    default: 'draft',
  },
  startTime: { type: Date },
  endTime: { type: Date },

  resultsPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },

  // Set once the "voting opens tomorrow" reminder email has gone out,
  // so the scheduled job never sends it twice.
  reminderSent: { type: Boolean, default: false },

}, { timestamps: true });

module.exports = mongoose.model('Election', electionSchema);

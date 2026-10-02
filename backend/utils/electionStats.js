const mongoose = require('mongoose');
const Voter = require('../models/Voter');
const Candidate = require('../models/Candidate');
const VoteRecord = require('../models/VoteRecord');

// Approved voters who are entitled to vote in this election: everyone
// nationwide for a national contest, or only the matching area for a local one.
function eligibleVoterQuery(election) {
  const query = { registrationStatus: 'approved' };
  if (election.scope === 'local') {
    query.province = election.province;
    query.district = election.district;
    query.municipality = election.municipality;
    if (election.ward) query.ward = election.ward;
  }
  return query;
}

// Whether one specific voter may vote in one specific election. This is the
// same rule as eligibleVoterQuery, applied to a single voter — it is what
// stops a voter from casting a ballot in another area's election by calling
// the API directly.
function isEligibleVoter(voter, election) {
  if (voter.registrationStatus !== 'approved') return false;
  if (election.scope === 'national') return true;
  if (voter.province !== election.province
    || voter.district !== election.district
    || voter.municipality !== election.municipality) return false;
  return !election.ward || voter.ward === election.ward;
}

// How many eligible voters there are and how many have voted. `voted` counts
// people who participated (Voter.votedElections) — it says nothing about
// WHO they voted for, so it is safe to show to admins and the public.
async function getTurnout(election) {
  const [eligible, voted] = await Promise.all([
    Voter.countDocuments(eligibleVoterQuery(election)),
    Voter.countDocuments({ votedElections: election._id }),
  ]);
  return { eligible, voted };
}

// Vote count per candidate, highest first. Includes candidates who received
// zero votes — a plain aggregate over VoteRecord would leave them out.
async function getTally(electionId) {
  const [candidates, grouped] = await Promise.all([
    Candidate.find({ election: electionId }),
    VoteRecord.aggregate([
      { $match: { election: new mongoose.Types.ObjectId(String(electionId)) } },
      { $group: { _id: '$candidate', votes: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(grouped.map((g) => [String(g._id), g.votes]));
  return candidates
    .map((candidate) => ({ candidate, votes: counts.get(String(candidate._id)) || 0 }))
    .sort((a, b) => b.votes - a.votes);
}

module.exports = { eligibleVoterQuery, isEligibleVoter, getTurnout, getTally };

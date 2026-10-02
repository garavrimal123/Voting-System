const mongoose = require('mongoose');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const VoteRecord = require('../models/VoteRecord');
const Voter = require('../models/Voter');
const { sendEmail } = require('../utils/email');
const { getTally, getTurnout, isEligibleVoter } = require('../utils/electionStats');

// Rotated at random so the confirmation email doesn't feel like the same
// canned line every time. Never mentions who/what was voted for — the
// email confirms participation only, never choice, to preserve anonymity.
const CIVIC_LINES = [
  'Every vote is a brick in the foundation of a stronger, more developed Nepal.',
  'Thank you for taking part in shaping your community\'s future — this is how real change begins.',
  'Your participation today helps build a more accountable and prosperous Nepal for tomorrow.',
  'Local leadership starts with local voters — thank you for doing your part for Nepal\'s progress.',
  'Democracy works because citizens like you show up. Thank you for helping move Nepal forward.',
];

// GET /api/elections — elections relevant to the voter: their local-level
// contests, plus every national-scope election regardless of location.
async function listElectionsForVoter(req, res) {
  const voter = await Voter.findById(req.user.id);
  const elections = await Election.find({
    $or: [
      { scope: 'national' },
      {
        scope: 'local',
        province: voter.province,
        district: voter.district,
        municipality: voter.municipality,
        $or: [{ ward: { $exists: false } }, { ward: null }, { ward: voter.ward }],
      },
    ],
  });

  const now = new Date();
  const withStatus = elections.map(e => {
    const hasVoted = voter.votedElections.some(id => id.equals(e._id));
    return {
      _id: e._id,
      title: e.title,
      level: e.level,
      scope: e.scope,
      status: e.status,
      startTime: e.startTime,
      endTime: e.endTime,
      hasVoted,
      // votingOpenNow accounts for admin status AND the time window
      votingOpenNow: e.status === 'open' && e.startTime <= now && now <= e.endTime,
      resultsPublished: e.resultsPublished,
    };
  });
  res.json(withStatus);
}

// GET /api/elections/:id/candidates
async function getCandidates(req, res) {
  const candidates = await Candidate.find({ election: req.params.id });
  res.json(candidates);
}

// POST /api/elections/:id/vote   body: { candidateId }
// The single most important function in this system.
async function castVote(req, res) {
  const electionId = req.params.id;
  const { candidateId } = req.body;
  const voterId = req.user.id;

  const election = await Election.findById(electionId);
  if (!election) return res.status(404).json({ message: 'Election not found.' });

  // A voter may only vote in elections for their own area (or national ones).
  // Without this, anyone logged in could vote in any election by ID.
  const voterDoc = await Voter.findById(voterId);
  if (!voterDoc || !isEligibleVoter(voterDoc, election)) {
    return res.status(403).json({ message: 'You are not eligible to vote in this election.' });
  }

  const now = new Date();
  if (election.status !== 'open' || now < election.startTime || now > election.endTime) {
    return res.status(403).json({ message: 'Voting is not currently open for this election.' });
  }

  const candidate = await Candidate.findOne({ _id: candidateId, election: electionId });
  if (!candidate) return res.status(400).json({ message: 'Invalid candidate for this election.' });

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // Atomic guard: only succeeds if electionId is NOT already in votedElections.
      // If two requests race, only one findOneAndUpdate can match+update first;
      // the second finds electionId already present and returns null.
      const updatedVoter = await Voter.findOneAndUpdate(
        { _id: voterId, votedElections: { $ne: electionId } },
        { $push: { votedElections: electionId } },
        { new: true, session }
      );

      if (!updatedVoter) {
        throw new Error('ALREADY_VOTED');
      }

      // The anonymous ballot — no voter reference exists or ever will.
      await VoteRecord.create([{ election: electionId, candidate: candidateId }], { session });
      result = 'ok';
    });

    if (result === 'ok') {
      const voter = voterDoc;
      const line = CIVIC_LINES[Math.floor(Math.random() * CIVIC_LINES.length)];
      await sendEmail(voter.email, 'Your Vote Has Been Cast',
        `Dear ${voter.fullName},\n\nYou have successfully cast your vote in "${election.title}".\n\n` +
        `${line}\n\nThank you for participating.`
      );
      return res.json({ message: 'Vote cast successfully. Thank you for voting.' });
    }
  } catch (err) {
    if (err.message === 'ALREADY_VOTED') {
      return res.status(409).json({ message: 'You have already voted in this election.' });
    }
    return res.status(500).json({ message: 'Vote could not be recorded.', error: err.message });
  } finally {
    session.endSession();
  }
}

// GET /api/elections/:id/results  — only returns data once admin has published.
async function getResults(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Not found.' });
  if (!election.resultsPublished) {
    return res.status(403).json({ message: 'Results have not been published yet.' });
  }
  const [results, turnout] = await Promise.all([getTally(election._id), getTurnout(election)]);
  res.json({
    election: election.title,
    publishedAt: election.publishedAt,
    results,
    turnout,
  });
}

// --- Public results (no login) ---------------------------------------------
// Only elections whose results the admin has published are ever exposed here,
// and only aggregate numbers: nothing links a vote to a voter.

const PUBLIC_ELECTION_FIELDS = 'title scope level province district municipality ward publishedAt';

// GET /api/public/elections
async function listPublishedElections(req, res) {
  const elections = await Election.find({ resultsPublished: true })
    .sort({ publishedAt: -1 })
    .select(PUBLIC_ELECTION_FIELDS);
  res.json(elections);
}

// GET /api/public/elections/:id/results
async function getPublicResults(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Results are not available for this election.' });
  }
  const election = await Election.findById(req.params.id);
  if (!election || !election.resultsPublished) {
    return res.status(404).json({ message: 'Results are not available for this election.' });
  }

  const [tally, turnout] = await Promise.all([getTally(election._id), getTurnout(election)]);
  const total = tally.reduce((sum, r) => sum + r.votes, 0);

  res.json({
    election: {
      _id: election._id, title: election.title, scope: election.scope, level: election.level,
      province: election.province, district: election.district,
      municipality: election.municipality, ward: election.ward,
    },
    publishedAt: election.publishedAt,
    total,
    turnout,
    results: tally.map((r) => ({
      candidate: {
        _id: r.candidate._id, name: r.candidate.name, party: r.candidate.party,
        photoUrl: r.candidate.photoUrl, symbolUrl: r.candidate.symbolUrl,
      },
      votes: r.votes,
      percent: total ? Math.round((r.votes / total) * 1000) / 10 : 0,
    })),
  });
}

module.exports = {
  listElectionsForVoter, getCandidates, castVote, getResults,
  listPublishedElections, getPublicResults,
};

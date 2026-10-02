const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Voter = require('../models/Voter');
const VoterUpdateRequest = require('../models/VoterUpdateRequest');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const VoteRecord = require('../models/VoteRecord');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const { generateVoterId, generateTempPassword } = require('../utils/generateCredentials');
const { sendEmail } = require('../utils/email');
const { logAction } = require('../utils/audit');
const { checkLock, registerFailedAttempt, clearFailedAttempts } = require('../utils/loginRateLimit');
const { toCsv } = require('../utils/csv');
const { eligibleVoterQuery, getTurnout, getTally: computeTally } = require('../utils/electionStats');

// POST /api/admin/login  — the ONLY way to authenticate as admin.
// There is no admin-registration endpoint anywhere in this API.
async function login(req, res) {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(401).json({ message: 'Invalid credentials.' });

  const lockMessage = checkLock(admin);
  if (lockMessage) return res.status(429).json({ message: lockMessage });

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    registerFailedAttempt(admin);
    await admin.save();
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  clearFailedAttempts(admin);
  await admin.save();

  const token = jwt.sign({ id: admin._id, role: 'admin', username: admin.username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  // No req.user yet at login, so pass the identity explicitly.
  await logAction({ user: { id: admin._id, username: admin.username } }, 'admin_login', 'Admin', admin._id, 'Admin logged in');
  res.json({ token });
}

// GET /api/admin/registrations?status=pending&search=term
async function listRegistrations(req, res) {
  const { status = 'pending', search } = req.query;
  const query = { registrationStatus: status };
  if (search && search.trim()) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { fullName: re }, { phone: re }, { email: re }, { applicationId: re },
      { voterId: re }, { citizenshipNumber: re },
    ];
  }
  const voters = await Voter.find(query).select('-passwordHash').sort({ createdAt: -1 });
  res.json(voters);
}

// GET /api/admin/registrations/export?status=approved  — CSV download.
// Deliberately leaves out citizenship numbers and dates of birth: the file
// ends up on someone's disk, so it carries only what a voter list needs.
async function exportRegistrations(req, res) {
  const { status = 'approved' } = req.query;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  const voters = await Voter.find({ registrationStatus: status })
    .select('-passwordHash -resetOtpHash -updateOtpHash')
    .sort({ createdAt: 1 });

  const csv = toCsv(
    ['Application ID', 'Voter ID', 'Full Name', 'Gender', 'Phone', 'Email',
     'Province', 'District', 'Municipality', 'Ward', 'Status', 'Submitted At'],
    voters.map((v) => [
      v.applicationId, v.voterId || '', v.fullName, v.gender, v.phone, v.email,
      v.province, v.district, v.municipality, v.ward, v.registrationStatus, v.createdAt,
    ])
  );
  await logAction(req, 'export_voters', 'Voter', undefined, `Exported ${voters.length} ${status} voter record(s) to CSV`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=voters-${status}.csv`);
  res.send(csv);
}

// POST /api/admin/registrations/:id/approve
// Generates Voter ID + temp password, emails them, marks approved.
async function approveAndGenerateVoterId(req, res) {
  const voter = await Voter.findById(req.params.id);
  if (!voter) return res.status(404).json({ message: 'Voter record not found.' });
  if (voter.registrationStatus === 'approved') {
    return res.status(400).json({ message: 'Already approved.' });
  }

  let voterId;
  do { voterId = generateVoterId(); } while (await Voter.exists({ voterId }));
  const tempPassword = generateTempPassword();

  voter.voterId = voterId;
  voter.passwordHash = await bcrypt.hash(tempPassword, 10);
  voter.mustChangePassword = true;
  voter.registrationStatus = 'approved';
  await voter.save();

  await sendEmail(voter.email, 'Voter Registration Approved',
    `Dear ${voter.fullName},\n\nYour voter registration (Application ID: ${voter.applicationId}) is approved.\n\n` +
    `Voter ID: ${voterId}\nTemporary Password: ${tempPassword}\n\n` +
    `Please log in and change your password before voting begins.`
  );

  await logAction(req, 'approve_registration', 'Voter', voter._id, `Approved ${voter.fullName} (${voter.applicationId}) as ${voterId}`);
  res.json({ message: 'Voter approved and credentials sent.', voterId });
}

// POST /api/admin/registrations/:id/reject   body: { reason }
async function rejectRegistration(req, res) {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: 'A rejection reason is required.' });
  }
  const voter = await Voter.findById(req.params.id);
  if (!voter) return res.status(404).json({ message: 'Not found.' });
  voter.registrationStatus = 'rejected';
  voter.rejectionReason = reason.trim();
  await voter.save();
  await sendEmail(voter.email, 'Voter Registration Rejected',
    `Dear ${voter.fullName},\n\nYour voter registration (Application ID: ${voter.applicationId}) was rejected.\n\n` +
    `Reason: ${reason.trim()}\n\nPlease correct this and contact your ward office if you have questions.`
  );
  await logAction(req, 'reject_registration', 'Voter', voter._id, `Rejected ${voter.fullName} (${voter.applicationId}): ${reason.trim()}`);
  res.json({ message: 'Registration rejected.' });
}

// --- Election management ---

// GET /api/admin/elections
async function listElections(req, res) {
  const elections = await Election.find().sort({ createdAt: -1 });
  res.json(elections);
}

// Two not-yet-closed elections for the same seat would split the vote, so
// they're blocked. Ward-member contests are exempt: a ward elects several
// members, so more than one such contest per ward is legitimate.
async function findDuplicateElection({ level, scope, province, district, municipality, ward }, excludeId = null) {
  if (level === 'ward_member') return null;
  const query = { level, scope, status: { $ne: 'closed' } };
  if (scope === 'local') {
    query.province = province;
    query.district = district;
    query.municipality = municipality;
    if (ward) query.ward = ward;
  }
  if (excludeId) query._id = { $ne: excludeId };
  return Election.findOne(query);
}

// POST /api/admin/elections
async function createElection(req, res) {
  const { scope = 'local' } = req.body;
  if (scope === 'local') {
    const { province, district, municipality } = req.body;
    if (!province || !district || !municipality) {
      return res.status(400).json({ message: 'Province, district, and municipality are required for a local election.' });
    }
  }
  // National elections ignore any location fields sent, even if present.
  const payload = { ...req.body, scope };
  if (scope === 'national') {
    delete payload.province; delete payload.district; delete payload.municipality; delete payload.ward;
  }

  const duplicate = await findDuplicateElection(payload);
  if (duplicate) {
    return res.status(409).json({ message: `An active election for this seat already exists: "${duplicate.title}".` });
  }

  const election = await Election.create(payload);
  await logAction(req, 'create_election', 'Election', election._id, `Created "${election.title}" (${scope})`);
  res.status(201).json(election);
}

// PUT /api/admin/elections/:id  — only while still in draft, to avoid
// changing the terms of a contest that's already open or closed.
async function updateElection(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  if (election.status !== 'draft') {
    return res.status(400).json({ message: 'Only draft elections can be edited.' });
  }
  const { scope = election.scope } = req.body;
  if (scope === 'local') {
    const { province, district, municipality } = req.body;
    if (!province || !district || !municipality) {
      return res.status(400).json({ message: 'Province, district, and municipality are required for a local election.' });
    }
  }
  const payload = { ...req.body, scope };
  if (scope === 'national') {
    payload.province = undefined; payload.district = undefined; payload.municipality = undefined; payload.ward = undefined;
  }

  // Editing the location/level must not collide with another active election.
  const duplicate = await findDuplicateElection({ ...payload, level: payload.level || election.level }, election._id);
  if (duplicate) {
    return res.status(409).json({ message: `Another active election for this seat already exists: "${duplicate.title}".` });
  }

  Object.assign(election, payload);
  await election.save();
  await logAction(req, 'update_election', 'Election', election._id, `Updated "${election.title}"`);
  res.json(election);
}

// DELETE /api/admin/elections/:id  — only while still in draft.
async function deleteElection(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  if (election.status !== 'draft') {
    return res.status(400).json({ message: 'Only draft elections can be deleted. Elections that opened must be kept for the record.' });
  }
  await Candidate.deleteMany({ election: election._id });
  await election.deleteOne();
  await logAction(req, 'delete_election', 'Election', election._id, `Deleted "${election.title}"`);
  res.json({ message: 'Election and its candidates deleted.' });
}

// GET /api/admin/elections/:id  (election + its candidates + live turnout, for the manage page)
async function getElectionDetail(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  const [candidates, stats] = await Promise.all([
    Candidate.find({ election: election._id }),
    getTurnout(election),
  ]);
  res.json({ election, candidates, stats });
}

// POST /api/admin/elections/:id/candidates
async function addCandidate(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  if (election.status !== 'draft') {
    return res.status(400).json({ message: 'Candidates can only be added while the election is in draft.' });
  }
  if (!req.files?.photo || !req.files?.symbol) {
    return res.status(400).json({ message: 'Both a candidate photo and a party symbol are required.' });
  }
  const duplicateParty = await Candidate.findOne({ election: election._id, party: req.body.party });
  if (duplicateParty) {
    return res.status(409).json({ message: `${req.body.party} already has a candidate in this election.` });
  }

  const candidate = await Candidate.create({
    election: req.params.id,
    name: req.body.name,
    party: req.body.party,
    photoUrl: req.files.photo[0].path,
    symbolUrl: req.files.symbol[0].path,
  });
  await logAction(req, 'add_candidate', 'Candidate', candidate._id, `Added ${candidate.name} (${candidate.party}) to "${election.title}"`);
  res.status(201).json(candidate);
}

// PUT /api/admin/candidates/:id  — only while the election is in draft.
async function updateCandidate(req, res) {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) return res.status(404).json({ message: 'Candidate not found.' });
  const election = await Election.findById(candidate.election);
  if (election.status !== 'draft') {
    return res.status(400).json({ message: 'Candidates can only be edited while the election is in draft.' });
  }
  if (req.body.name) candidate.name = req.body.name;
  if (req.body.party) candidate.party = req.body.party;
  if (req.files?.photo) candidate.photoUrl = req.files.photo[0].path;
  if (req.files?.symbol) candidate.symbolUrl = req.files.symbol[0].path;
  await candidate.save();
  await logAction(req, 'update_candidate', 'Candidate', candidate._id, `Updated ${candidate.name} (${candidate.party})`);
  res.json(candidate);
}

// DELETE /api/admin/candidates/:id  — only while the election is in draft.
async function deleteCandidate(req, res) {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) return res.status(404).json({ message: 'Candidate not found.' });
  const election = await Election.findById(candidate.election);
  if (election.status !== 'draft') {
    return res.status(400).json({ message: 'Candidates can only be removed while the election is in draft.' });
  }
  await candidate.deleteOne();
  await logAction(req, 'delete_candidate', 'Candidate', candidate._id, `Removed ${candidate.name} (${candidate.party}) from "${election.title}"`);
  res.json({ message: 'Candidate removed.' });
}

// POST /api/admin/elections/:id/open   body: { startTime, endTime }
async function openElection(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  if (election.status !== 'draft') {
    return res.status(400).json({ message: 'Only draft elections can be opened.' });
  }

  const start = new Date(req.body.startTime);
  const end = new Date(req.body.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ message: 'Please provide a valid start and end time.' });
  }
  if (end <= start) {
    return res.status(400).json({ message: 'The end time must be after the start time.' });
  }
  if (end <= new Date()) {
    return res.status(400).json({ message: 'The end time must be in the future.' });
  }

  const candidateCount = await Candidate.countDocuments({ election: election._id });
  if (candidateCount < 2) {
    return res.status(400).json({ message: 'Add at least 2 candidates before opening voting.' });
  }

  election.status = 'open';
  election.startTime = start;
  election.endTime = end;
  election.reminderSent = false;
  await election.save();
  await logAction(req, 'open_election', 'Election', election._id,
    `Opened "${election.title}" (${start.toISOString()} to ${end.toISOString()})`);
  res.json(election);
}

// POST /api/admin/elections/:id/close
async function closeElection(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  if (election.status !== 'open') {
    return res.status(400).json({ message: 'Only an open election can be closed.' });
  }
  election.status = 'closed';
  election.endTime = new Date();
  await election.save();
  await logAction(req, 'close_election', 'Election', election._id, `Closed "${election.title}" early`);
  res.json(election);
}

// GET /api/admin/elections/:id/tally
// Vote counts per candidate — never joined against any voter, since
// VoteRecord has no voter field. Only available once voting has closed, so
// nobody (admin included) can watch live counts while people are voting.
async function getTally(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Election not found.' });
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  if (election.status !== 'closed') {
    return res.status(403).json({ message: 'Results can only be viewed after voting has closed.' });
  }
  res.json(await computeTally(election._id));
}

// GET /api/admin/elections/:id/export  — results as CSV (closed elections only)
async function exportTally(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Election not found.' });
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  if (election.status !== 'closed') {
    return res.status(403).json({ message: 'Results can only be exported after voting has closed.' });
  }

  const [results, turnout] = await Promise.all([computeTally(election._id), getTurnout(election)]);
  const total = results.reduce((sum, r) => sum + r.votes, 0);
  const percent = (votes) => (total ? `${((votes / total) * 100).toFixed(2)}%` : '0.00%');

  const rows = results.map((r) => [r.candidate.name, r.candidate.party, r.votes, percent(r.votes)]);
  rows.push(['TOTAL', '', total, total ? '100.00%' : '0.00%']);
  rows.push([]);
  rows.push(['Eligible voters', '', turnout.eligible, '']);
  rows.push(['Voters who voted', '', turnout.voted,
    turnout.eligible ? `${((turnout.voted / turnout.eligible) * 100).toFixed(2)}%` : '0.00%']);

  const csv = toCsv(['Candidate', 'Party', 'Votes', 'Share of votes'], rows);
  const slug = election.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'election';
  await logAction(req, 'export_results', 'Election', election._id, `Exported results of "${election.title}" to CSV`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=results-${slug}.csv`);
  res.send(csv);
}

// POST /api/admin/elections/:id/publish
async function publishResults(req, res) {
  const election = await Election.findById(req.params.id);
  if (!election) return res.status(404).json({ message: 'Election not found.' });
  // Publishing an election that's still open would expose live counts.
  if (election.status !== 'closed') {
    return res.status(400).json({ message: 'Results can only be published after voting has closed.' });
  }
  if (election.resultsPublished) {
    return res.status(400).json({ message: 'Results are already published.' });
  }

  election.resultsPublished = true;
  election.publishedAt = new Date();
  await election.save();
  await logAction(req, 'publish_results', 'Election', election._id, `Published results of "${election.title}"`);

  // Notify every eligible voter (a national election notifies everyone).
  // Best-effort — a slow or failed email must never block the publish itself.
  const voters = await Voter.find(eligibleVoterQuery(election)).select('fullName email');
  Promise.all(voters.map((v) =>
    sendEmail(v.email, 'Election Results Published',
      `Dear ${v.fullName},\n\nResults for "${election.title}" have been published.\n\n` +
      `Log in to your voter dashboard and open this election to view the results, ` +
      `or see them on the Public Results page.\n\n` +
      `Thank you for participating in Nepal's local level election.`
    )
  )).catch(() => {}); // individual failures are already logged by sendEmail itself

  res.json(election);
}

// --- Voter-submitted detail-correction requests ---

// GET /api/admin/update-requests?status=pending
async function listUpdateRequests(req, res) {
  const { status = 'pending' } = req.query;
  const requests = await VoterUpdateRequest.find({ status }).populate('voter', 'fullName voterId phone email');
  res.json(requests);
}

// POST /api/admin/update-requests/:id/approve
// Applies the requested changes to the live Voter record.
async function approveUpdateRequest(req, res) {
  const request = await VoterUpdateRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found.' });
  if (request.status !== 'pending') return res.status(400).json({ message: 'This request was already reviewed.' });

  const voter = await Voter.findById(request.voter);
  if (!voter) return res.status(404).json({ message: 'Voter record not found.' });

  const c = request.changes;
  if (c.phone || c.email || c.citizenshipNumber) {
    const conflict = await Voter.findOne({
      _id: { $ne: voter._id },
      $or: [{ phone: c.phone || voter.phone }, { email: c.email || voter.email }, { citizenshipNumber: c.citizenshipNumber || voter.citizenshipNumber }],
    });
    if (conflict) {
      return res.status(409).json({ message: 'Cannot approve — the requested phone, email, or citizenship number is now used by another voter.' });
    }
  }

  if (c.fullName) voter.fullName = c.fullName;
  if (c.phone) voter.phone = c.phone;
  if (c.email) voter.email = c.email;
  if (c.province) voter.province = c.province;
  if (c.district) voter.district = c.district;
  if (c.municipality) voter.municipality = c.municipality;
  if (c.ward) voter.ward = c.ward;
  if (c.citizenshipNumber) voter.citizenshipNumber = c.citizenshipNumber;
  if (request.newCitizenshipDocUrl) voter.citizenshipDocUrl = request.newCitizenshipDocUrl;
  if (request.newPhotoUrl) voter.photoUrl = request.newPhotoUrl;
  await voter.save();

  request.status = 'approved';
  await request.save();
  await logAction(req, 'approve_update_request', 'VoterUpdateRequest', request._id,
    `Approved ${request.trackingId} for ${voter.fullName}`);

  await sendEmail(voter.email, 'Detail Correction Approved',
    `Dear ${voter.fullName},\n\nYour requested correction (${request.trackingId}) has been approved and applied to your voter record.`
  );
  res.json({ message: 'Update approved and applied.' });
}

// POST /api/admin/update-requests/:id/reject   body: { reason }
async function rejectUpdateRequest(req, res) {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ message: 'A rejection reason is required.' });
  const request = await VoterUpdateRequest.findById(req.params.id).populate('voter', 'fullName email');
  if (!request) return res.status(404).json({ message: 'Request not found.' });
  if (request.status !== 'pending') return res.status(400).json({ message: 'This request was already reviewed.' });

  request.status = 'rejected';
  request.reviewReason = reason.trim();
  await request.save();
  await logAction(req, 'reject_update_request', 'VoterUpdateRequest', request._id,
    `Rejected ${request.trackingId} for ${request.voter.fullName}: ${reason.trim()}`);

  await sendEmail(request.voter.email, 'Detail Correction Rejected',
    `Dear ${request.voter.fullName},\n\nYour requested correction (${request.trackingId}) was rejected.\n\nReason: ${reason.trim()}`
  );
  res.json({ message: 'Request rejected.' });
}

// GET /api/admin/stats  — quick dashboard summary
async function getStats(req, res) {
  const [pending, approved, rejected, elections, openElections, pendingUpdates] = await Promise.all([
    Voter.countDocuments({ registrationStatus: 'pending' }),
    Voter.countDocuments({ registrationStatus: 'approved' }),
    Voter.countDocuments({ registrationStatus: 'rejected' }),
    Election.countDocuments(),
    Election.countDocuments({ status: 'open' }),
    VoterUpdateRequest.countDocuments({ status: 'pending' }),
  ]);
  res.json({ pending, approved, rejected, elections, openElections, pendingUpdates });
}

// GET /api/admin/audit-logs?limit=200  — most recent admin actions first
async function listAuditLogs(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  res.json(logs);
}

module.exports = {
  login, listRegistrations, exportRegistrations, approveAndGenerateVoterId, rejectRegistration,
  listElections, getElectionDetail, createElection, updateElection, deleteElection,
  addCandidate, updateCandidate, deleteCandidate,
  openElection, closeElection, getTally, exportTally, publishResults,
  listUpdateRequests, approveUpdateRequest, rejectUpdateRequest, getStats, listAuditLogs,
};

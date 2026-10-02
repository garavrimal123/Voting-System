const cron = require('node-cron');
const Election = require('../models/Election');
const Voter = require('../models/Voter');
const { sendEmail } = require('../utils/email');
const { eligibleVoterQuery } = require('../utils/electionStats');
const { logAction } = require('../utils/audit');

// Times in emails are shown in Nepal time no matter where the server runs.
const formatNepalTime = (date) =>
  `${date.toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', dateStyle: 'medium', timeStyle: 'short' })} (Nepal time)`;

// Guards so a slow run can never overlap with the next scheduled one.
let autoCloseRunning = false;
let reminderRunning = false;

// Any 'open' election whose end time has passed is closed automatically.
// Without this, voting stays technically open until an admin clicks "Close",
// even after the countdown hits zero.
async function closeExpiredElections() {
  if (autoCloseRunning) return;
  autoCloseRunning = true;
  try {
    const expired = await Election.find({ status: 'open', endTime: { $lte: new Date() } });
    for (const election of expired) {
      // Conditional update: if an admin closed it a moment ago, do nothing.
      const result = await Election.updateOne({ _id: election._id, status: 'open' }, { status: 'closed' });
      if (!result.modifiedCount) continue;
      await logAction(null, 'auto_close_election', 'Election', election._id,
        `Closed "${election.title}" automatically at its end time`);
      console.log(`[AUTO-CLOSE] Closed "${election.title}"`);
    }
  } catch (err) {
    console.error('[AUTO-CLOSE JOB FAILED]', err.message);
  } finally {
    autoCloseRunning = false;
  }
}

// An election that starts within the next 24 hours gets one reminder email,
// sent to every eligible voter.
async function sendUpcomingReminders() {
  if (reminderRunning) return;
  reminderRunning = true;
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    // `$ne: true` (not `false`) so elections created before this field
    // existed — where it's missing entirely — are still picked up.
    const upcoming = await Election.find({
      reminderSent: { $ne: true },
      status: { $in: ['open', 'scheduled'] },
      startTime: { $gt: now, $lte: in24h },
    });

    for (const election of upcoming) {
      // Claim it BEFORE sending, atomically, so two runs can never both send.
      const claimed = await Election.updateOne(
        { _id: election._id, reminderSent: { $ne: true } },
        { reminderSent: true }
      );
      if (!claimed.modifiedCount) continue;

      const voters = await Voter.find(eligibleVoterQuery(election)).select('fullName email');
      // One at a time: firing thousands of emails at once gets an SMTP
      // account throttled or blocked.
      for (const v of voters) {
        await sendEmail(v.email, 'Voting Opens Soon',
          `Dear ${v.fullName},\n\nVoting for "${election.title}" opens on ${formatNepalTime(election.startTime)} ` +
          `and closes on ${formatNepalTime(election.endTime)}.\n\n` +
          `Log in to your voter dashboard when it's time to cast your vote.\n\nThank you for participating.`
        );
      }
      await logAction(null, 'send_reminders', 'Election', election._id,
        `Sent "voting opens soon" reminder for "${election.title}" to ${voters.length} voter(s)`);
      console.log(`[REMINDER] "${election.title}": ${voters.length} voter(s)`);
    }
  } catch (err) {
    console.error('[REMINDER JOB FAILED]', err.message);
  } finally {
    reminderRunning = false;
  }
}

function startScheduledJobs() {
  cron.schedule('* * * * *', closeExpiredElections);       // every minute
  cron.schedule('*/15 * * * *', sendUpcomingReminders);    // every 15 minutes
  console.log('Scheduled jobs started: auto-close (every minute), reminders (every 15 minutes).');
}

module.exports = { startScheduledJobs, closeExpiredElections, sendUpcomingReminders };

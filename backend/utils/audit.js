const AuditLog = require('../models/AuditLog');

// Fire-and-forget — an audit log write failing should never block the
// actual action it's recording.
//
// Pass the Express `req` for admin actions. Pass null for actions the system
// performs on its own (scheduled jobs); those are logged as 'system'.
async function logAction(req, action, targetType, targetId, details) {
  try {
    await AuditLog.create({
      admin: req?.user?.id,
      adminUsername: req?.user?.username || 'system',
      action, targetType, targetId, details,
    });
  } catch (err) {
    console.error('[AUDIT LOG FAILED]', action, err.message);
  }
}

module.exports = { logAction };

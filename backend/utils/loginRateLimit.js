const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Call before checking the password. Throws-by-return: returns a message
// string if the account is currently locked, or null if login can proceed.
function checkLock(account) {
  if (account.lockUntil && account.lockUntil > new Date()) {
    const minutesLeft = Math.ceil((account.lockUntil.getTime() - Date.now()) / 60000);
    return `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`;
  }
  return null;
}

// Call on a wrong password. Mutates the account in memory — caller must save().
function registerFailedAttempt(account) {
  account.failedLoginAttempts = (account.failedLoginAttempts || 0) + 1;
  if (account.failedLoginAttempts >= MAX_ATTEMPTS) {
    account.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    account.failedLoginAttempts = 0;
  }
}

// Call on a correct password. Mutates the account in memory — caller must save().
function clearFailedAttempts(account) {
  account.failedLoginAttempts = 0;
  account.lockUntil = undefined;
}

module.exports = { checkLock, registerFailedAttempt, clearFailedAttempts, MAX_ATTEMPTS };

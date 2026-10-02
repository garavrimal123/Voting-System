const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Voter = require('../models/Voter');
const VoterUpdateRequest = require('../models/VoterUpdateRequest');
const { generateRegistrationPDF } = require('../utils/pdfGenerator');
const { sendEmail } = require('../utils/email');
const { generateApplicationId, generateTrackingId } = require('../utils/generateCredentials');
const { checkLock, registerFailedAttempt, clearFailedAttempts } = require('../utils/loginRateLimit');

// Nepali citizenship numbers are commonly written as
// District-Municipality/VDC-Ward-Serial, e.g. 27-01-70-01234
const CITIZENSHIP_FORMAT = /^\d{1,3}-\d{1,3}-\d{1,3}-\d{1,6}$/;

// One-time codes: valid for 10 minutes, at most 5 wrong guesses per code,
// and no more than one new code per minute (stops email-bombing a voter).
const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const otpSentRecently = (expiresAt) =>
  !!expiresAt && Date.now() - (expiresAt.getTime() - OTP_LIFETIME_MS) < OTP_RESEND_COOLDOWN_MS;

function calculateAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Phone, email, and citizenship number must EACH be unique across all
// voters — no two voter records may share any single one of these three,
// even if the other two differ. excludeId lets a voter's own existing
// record be excluded when checking during a resubmission or update.
async function findFieldConflict(phone, email, citizenshipNumber, excludeId = null) {
  const query = {
    $or: [{ phone }, { email }, { citizenshipNumber }],
  };
  if (excludeId) query._id = { $ne: excludeId };
  const conflict = await Voter.findOne(query);
  if (!conflict) return null;
  if (conflict.phone === phone) return 'phone number';
  if (conflict.email === email) return 'email address';
  return 'citizenship number';
}

// POST /api/voters/register  (multipart/form-data)
async function register(req, res) {
  try {
    const { fullName, dateOfBirth, gender, phone, email,
            province, district, municipality, ward, citizenshipNumber } = req.body;

    const age = calculateAge(dateOfBirth);
    if (age === null) {
      return res.status(400).json({ message: 'Please provide a valid date of birth.' });
    }
    if (age < 18) {
      return res.status(400).json({ message: 'You must be at least 18 years old to register as a voter.' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    if (!CITIZENSHIP_FORMAT.test(citizenshipNumber || '')) {
      return res.status(400).json({
        message: 'Citizenship number must be in the format XX-XX-XX-XXXXX (e.g. 27-01-70-01234).',
      });
    }

    if (!req.files || !req.files.citizenshipDoc || !req.files.photo) {
      return res.status(400).json({ message: 'Citizenship document and photo are both required.' });
    }

    const conflictField = await findFieldConflict(phone, email, citizenshipNumber);
    if (conflictField) {
      return res.status(409).json({ message: `A registration with this ${conflictField} already exists.` });
    }

    let applicationId;
    do { applicationId = generateApplicationId(); } while (await Voter.exists({ applicationId }));

    const voter = await Voter.create({
      fullName, dateOfBirth, gender, phone, email,
      province, district, municipality, ward,
      citizenshipNumber, applicationId,
      citizenshipDocUrl: req.files.citizenshipDoc[0].path,
      photoUrl: req.files.photo[0].path,
    });

    const message = `Hi ${fullName}, your voter registration has been received. Your Application ID is ${applicationId} — use it to track your status. You will receive your Voter ID by email once approved.`;
    await sendEmail(email, 'Voter Registration Received', message);

    res.status(201).json({
      message: 'Registration submitted successfully. Await admin verification.',
      voterRecordId: voter._id,
      applicationId,
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
}

// GET /api/voters/track/:applicationId   (public — no login required)
async function trackApplication(req, res) {
  const voter = await Voter.findOne({ applicationId: req.params.applicationId });
  if (!voter) return res.status(404).json({ message: 'No application found with that ID.' });

  const base = {
    applicationId: voter.applicationId,
    fullName: voter.fullName,
    status: voter.registrationStatus,
    rejectionReason: voter.registrationStatus === 'rejected' ? voter.rejectionReason : undefined,
    voterId: voter.registrationStatus === 'approved' ? voter.voterId : undefined,
    submittedAt: voter.createdAt,
  };

  // If rejected, include the editable fields so the applicant can correct
  // and resubmit through the same Application ID — no need to re-register.
  if (voter.registrationStatus === 'rejected') {
    Object.assign(base, {
      dateOfBirth: voter.dateOfBirth,
      gender: voter.gender,
      phone: voter.phone,
      email: voter.email,
      province: voter.province,
      district: voter.district,
      municipality: voter.municipality,
      ward: voter.ward,
      citizenshipNumber: voter.citizenshipNumber,
      citizenshipDocUrl: voter.citizenshipDocUrl,
      photoUrl: voter.photoUrl,
    });
  }

  res.json(base);
}

// PUT /api/voters/track/:applicationId   (public — resubmit after rejection)
// Only works while status is 'rejected'. New files are optional — if the
// applicant doesn't re-upload, the previously submitted ones are kept.
async function resubmitApplication(req, res) {
  const voter = await Voter.findOne({ applicationId: req.params.applicationId });
  if (!voter) return res.status(404).json({ message: 'No application found with that ID.' });
  if (voter.registrationStatus !== 'rejected') {
    return res.status(400).json({ message: 'Only rejected applications can be corrected and resubmitted.' });
  }

  const { fullName, dateOfBirth, gender, phone, email,
          province, district, municipality, ward, citizenshipNumber } = req.body;

  const age = calculateAge(dateOfBirth);
  if (age === null) return res.status(400).json({ message: 'Please provide a valid date of birth.' });
  if (age < 18) return res.status(400).json({ message: 'You must be at least 18 years old to register as a voter.' });
  if (!CITIZENSHIP_FORMAT.test(citizenshipNumber || '')) {
    return res.status(400).json({ message: 'Citizenship number must be in the format XX-XX-XX-XXXXX (e.g. 27-01-70-01234).' });
  }

  const conflictField = await findFieldConflict(phone, email, citizenshipNumber, voter._id);
  if (conflictField) {
    return res.status(409).json({ message: `Another registration with this ${conflictField} already exists.` });
  }

  voter.fullName = fullName;
  voter.dateOfBirth = dateOfBirth;
  voter.gender = gender;
  voter.phone = phone;
  voter.email = email;
  voter.province = province;
  voter.district = district;
  voter.municipality = municipality;
  voter.ward = ward;
  voter.citizenshipNumber = citizenshipNumber;
  if (req.files?.citizenshipDoc) voter.citizenshipDocUrl = req.files.citizenshipDoc[0].path;
  if (req.files?.photo) voter.photoUrl = req.files.photo[0].path;

  voter.registrationStatus = 'pending';
  voter.rejectionReason = undefined;
  await voter.save();

  const message = `Hi ${fullName}, your corrected application (${voter.applicationId}) has been resubmitted and is pending review again.`;
  await sendEmail(email, 'Application Resubmitted', message);

  res.json({
    message: 'Application updated and resubmitted for review.',
    voterRecordId: voter._id,
    applicationId: voter.applicationId,
  });
}

// POST /api/voters/forgot-password   body: { voterId }
async function forgotPassword(req, res) {
  const { voterId } = req.body;
  const voter = await Voter.findOne({ voterId });
  // Always return the same generic response whether or not the Voter ID
  // exists, so this endpoint can't be used to check which IDs are valid.
  const genericResponse = { message: 'If that Voter ID exists, an OTP has been sent to its registered email.' };
  if (!voter) return res.json(genericResponse);
  // Within the cooldown, quietly do nothing — same response either way.
  if (otpSentRecently(voter.resetOtpExpires)) return res.json(genericResponse);

  const otp = String(crypto.randomInt(100000, 999999));
  voter.resetOtpHash = await bcrypt.hash(otp, 10);
  voter.resetOtpExpires = new Date(Date.now() + OTP_LIFETIME_MS);
  voter.resetOtpAttempts = 0;
  await voter.save();

  await sendEmail(voter.email, 'Password Reset Code',
    `Hi ${voter.fullName},\n\nYour password reset code is: ${otp}\n\n` +
    `This code expires in 10 minutes. If you didn't request this, you can ignore this email.`
  );

  res.json(genericResponse);
}

// POST /api/voters/reset-password   body: { voterId, otp, newPassword }
async function resetPassword(req, res) {
  const { voterId, otp, newPassword } = req.body;
  const voter = await Voter.findOne({ voterId });
  if (!voter || !voter.resetOtpHash || !voter.resetOtpExpires) {
    return res.status(400).json({ message: 'Invalid or expired code. Please request a new one.' });
  }
  if (voter.resetOtpExpires < new Date()) {
    return res.status(400).json({ message: 'This code has expired. Please request a new one.' });
  }
  const otpMatches = await bcrypt.compare(String(otp), voter.resetOtpHash);
  if (!otpMatches) {
    voter.resetOtpAttempts = (voter.resetOtpAttempts || 0) + 1;
    if (voter.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
      voter.resetOtpHash = undefined;
      voter.resetOtpExpires = undefined;
      voter.resetOtpAttempts = 0;
      await voter.save();
      return res.status(400).json({ message: 'Too many incorrect codes. Please request a new one.' });
    }
    await voter.save();
    return res.status(400).json({ message: 'Incorrect code.' });
  }

  const strongEnough = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(newPassword || '');
  if (!strongEnough) {
    return res.status(400).json({
      message: 'Password must be 8+ characters and include upper, lower, a digit, and a symbol.',
    });
  }

  voter.passwordHash = await bcrypt.hash(newPassword, 10);
  voter.mustChangePassword = false;
  voter.resetOtpHash = undefined;
  voter.resetOtpExpires = undefined;
  voter.resetOtpAttempts = 0;
  // A successful reset also clears any login lockout from earlier failed attempts.
  voter.failedLoginAttempts = 0;
  voter.lockUntil = undefined;
  await voter.save();

  res.json({ message: 'Password reset successfully. You can now log in.' });
}

// GET /api/voters/me  (auth required) — used to show current details
// alongside the "what do you want to change" form.
async function getMyProfile(req, res) {
  const voter = await Voter.findById(req.user.id).select('-passwordHash -resetOtpHash -updateOtpHash');
  if (!voter) return res.status(404).json({ message: 'Voter not found.' });
  res.json(voter);
}

// Fields that need documentary proof when changed. Photo, citizenship
// document, email, and phone are exempt — the upload itself is the proof
// for the first two, and OTP verification is the proof for the other two.
const FIELDS_REQUIRING_PROOF = ['fullName', 'province', 'district', 'municipality', 'ward', 'citizenshipNumber'];

// POST /api/voters/update-request/send-otp  (auth) body: { newEmail?, newPhone? }
async function sendUpdateOtp(req, res) {
  const voter = await Voter.findById(req.user.id);
  if (!voter) return res.status(404).json({ message: 'Voter not found.' });

  const { newEmail, newPhone } = req.body;
  if (!newEmail && !newPhone) {
    return res.status(400).json({ message: 'Provide the new email and/or phone you want to verify.' });
  }

  // New email → OTP to new email. Phone-only change → OTP to the CURRENT
  // (already-verified) email on file, since that's the trusted channel.
  const targetEmail = newEmail || voter.email;

  if (otpSentRecently(voter.updateOtpExpires)) {
    return res.status(429).json({ message: 'A code was just sent. Please wait a minute before requesting another.' });
  }

  const otp = String(crypto.randomInt(100000, 999999));
  voter.updateOtpHash = await bcrypt.hash(otp, 10);
  voter.updateOtpExpires = new Date(Date.now() + OTP_LIFETIME_MS);
  voter.updateOtpAttempts = 0;
  voter.updateOtpVerifiedAt = undefined;
  await voter.save();

  await sendEmail(targetEmail, 'Verification Code for Detail Update',
    `Hi ${voter.fullName},\n\nYour verification code is: ${otp}\n\n` +
    `Enter this code in the update form to confirm your new ${newEmail ? 'email' : 'phone number'}. ` +
    `This code expires in 10 minutes.`
  );

  res.json({ message: `A verification code was sent to ${targetEmail}.` });
}

// POST /api/voters/update-request/verify-otp  (auth) body: { otp }
async function verifyUpdateOtp(req, res) {
  const voter = await Voter.findById(req.user.id);
  if (!voter) return res.status(404).json({ message: 'Voter not found.' });
  const { otp } = req.body;

  if (!voter.updateOtpHash || !voter.updateOtpExpires) {
    return res.status(400).json({ message: 'No verification code was requested. Click "Send Code" first.' });
  }
  if (voter.updateOtpExpires < new Date()) {
    return res.status(400).json({ message: 'This code has expired. Please request a new one.' });
  }
  const matches = await bcrypt.compare(String(otp || ''), voter.updateOtpHash);
  if (!matches) {
    voter.updateOtpAttempts = (voter.updateOtpAttempts || 0) + 1;
    if (voter.updateOtpAttempts >= MAX_OTP_ATTEMPTS) {
      voter.updateOtpHash = undefined;
      voter.updateOtpExpires = undefined;
      voter.updateOtpAttempts = 0;
      await voter.save();
      return res.status(400).json({ message: 'Too many incorrect codes. Please request a new one.' });
    }
    await voter.save();
    return res.status(400).json({ message: 'Incorrect code.' });
  }

  voter.updateOtpVerifiedAt = new Date();
  voter.updateOtpHash = undefined;
  voter.updateOtpExpires = undefined;
  voter.updateOtpAttempts = 0;
  await voter.save();

  res.json({ message: 'Verified.', verified: true });
}

// POST /api/voters/update-request  (auth required — logged-in voter)
// Lets an already-approved voter request a correction to their details
// (spelling mistakes, changed phone, etc). Does NOT change the live
// record directly — queues it for admin review, same as registration.
async function submitUpdateRequest(req, res) {
  const voter = await Voter.findById(req.user.id);
  if (!voter) return res.status(404).json({ message: 'Voter not found.' });

  const { fullName, phone, email, province, district, municipality, ward, citizenshipNumber } = req.body;
  const changes = { fullName, phone, email, province, district, municipality, ward, citizenshipNumber };
  const changedFields = Object.entries(changes).filter(([, v]) => v).map(([k]) => k);

  if (changedFields.length === 0 && !req.files?.citizenshipDoc && !req.files?.photo) {
    return res.status(400).json({ message: 'Change at least one field before submitting.' });
  }

  if (citizenshipNumber && !CITIZENSHIP_FORMAT.test(citizenshipNumber)) {
    return res.status(400).json({ message: 'Citizenship number must be in the format XX-XX-XX-XXXXX (e.g. 27-01-70-01234).' });
  }
  if (phone || email || citizenshipNumber) {
    const conflictField = await findFieldConflict(
      phone || voter.phone, email || voter.email, citizenshipNumber || voter.citizenshipNumber, voter._id
    );
    if (conflictField) {
      return res.status(409).json({ message: `Another voter already uses this ${conflictField}.` });
    }
  }

  // Email or phone change requires a verified OTP from THIS session,
  // requested within the last 15 minutes.
  if (phone || email) {
    const recentlyVerified = voter.updateOtpVerifiedAt &&
      (Date.now() - voter.updateOtpVerifiedAt.getTime() < 15 * 60 * 1000);
    if (!recentlyVerified) {
      return res.status(403).json({ message: 'Please verify the OTP sent to your email before submitting.' });
    }
  }

  // Any other changed field needs a proof document.
  const needsProof = changedFields.some((f) => FIELDS_REQUIRING_PROOF.includes(f));
  if (needsProof && !req.files?.proofDocument) {
    return res.status(400).json({
      message: 'A supporting document proving the new information is correct is required for this change.',
    });
  }

  let trackingId;
  do { trackingId = generateTrackingId('UPD'); } while (await VoterUpdateRequest.exists({ trackingId }));

  const request = await VoterUpdateRequest.create({
    voter: voter._id,
    trackingId,
    changes,
    newCitizenshipDocUrl: req.files?.citizenshipDoc?.[0]?.path,
    newPhotoUrl: req.files?.photo?.[0]?.path,
    proofDocUrl: req.files?.proofDocument?.[0]?.path,
  });

  // Consume the OTP verification now that it's been used.
  voter.updateOtpVerifiedAt = undefined;
  await voter.save();

  const message = `Hi ${voter.fullName}, your detail-correction request (${trackingId}) has been submitted for review.`;
  await sendEmail(voter.email, 'Detail Correction Request Submitted', message);

  res.status(201).json({ message: 'Update request submitted for review.', trackingId });
}

// GET /api/voters/update-request/track/:trackingId  (public)
async function trackUpdateRequest(req, res) {
  const request = await VoterUpdateRequest.findOne({ trackingId: req.params.trackingId });
  if (!request) return res.status(404).json({ message: 'No request found with that tracking ID.' });
  res.json({
    trackingId: request.trackingId,
    status: request.status,
    reviewReason: request.status === 'rejected' ? request.reviewReason : undefined,
    submittedAt: request.createdAt,
  });
}

// GET /api/voters/:id/confirmation.pdf
async function downloadConfirmation(req, res) {
  const voter = await Voter.findById(req.params.id);
  if (!voter) return res.status(404).json({ message: 'Not found.' });
  await generateRegistrationPDF(voter, res);
}

// POST /api/voters/login
async function login(req, res) {
  const { voterId, password } = req.body;
  const voter = await Voter.findOne({ voterId });
  if (!voter || !voter.passwordHash) {
    return res.status(401).json({ message: 'Invalid Voter ID or password.' });
  }

  const lockMessage = checkLock(voter);
  if (lockMessage) return res.status(429).json({ message: lockMessage });

  const match = await bcrypt.compare(password, voter.passwordHash);
  if (!match) {
    registerFailedAttempt(voter);
    await voter.save();
    return res.status(401).json({ message: 'Invalid Voter ID or password.' });
  }

  clearFailedAttempts(voter);
  await voter.save();

  const token = jwt.sign(
    { id: voter._id, role: 'voter', mustChangePassword: voter.mustChangePassword },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
  res.json({ token, mustChangePassword: voter.mustChangePassword });
}

// POST /api/voters/change-password  (auth required)
async function changePassword(req, res) {
  const { newPassword } = req.body;
  const strongEnough = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(newPassword);
  if (!strongEnough) {
    return res.status(400).json({
      message: 'Password must be 8+ characters and include upper, lower, a digit, and a symbol.',
    });
  }
  const voter = await Voter.findById(req.user.id);
  voter.passwordHash = await bcrypt.hash(newPassword, 10);
  voter.mustChangePassword = false;
  await voter.save();
  res.json({ message: 'Password updated. Please log in again.' });
}

module.exports = {
  register, trackApplication, resubmitApplication, downloadConfirmation,
  login, changePassword, forgotPassword, resetPassword,
  getMyProfile, sendUpdateOtp, verifyUpdateOtp, submitUpdateRequest, trackUpdateRequest,
};

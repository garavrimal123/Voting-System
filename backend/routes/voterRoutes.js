const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrapAll } = require('../utils/asyncHandler');
const ctrl = wrapAll(require('../controllers/voterController'));

router.post('/register', upload.fields([
  { name: 'citizenshipDoc', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
]), ctrl.register);

router.get('/:id/confirmation.pdf', ctrl.downloadConfirmation);
router.get('/track/:applicationId', ctrl.trackApplication);
router.put('/track/:applicationId', upload.fields([
  { name: 'citizenshipDoc', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
]), ctrl.resubmitApplication);
router.post('/login', ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.post('/change-password', requireAuth, requireRole('voter'), ctrl.changePassword);

router.get('/me', requireAuth, requireRole('voter'), ctrl.getMyProfile);
router.post('/update-request/send-otp', requireAuth, requireRole('voter'), ctrl.sendUpdateOtp);
router.post('/update-request/verify-otp', requireAuth, requireRole('voter'), ctrl.verifyUpdateOtp);
router.post('/update-request', requireAuth, requireRole('voter'), upload.fields([
  { name: 'citizenshipDoc', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'proofDocument', maxCount: 1 },
]), ctrl.submitUpdateRequest);
router.get('/update-request/track/:trackingId', ctrl.trackUpdateRequest);

module.exports = router;

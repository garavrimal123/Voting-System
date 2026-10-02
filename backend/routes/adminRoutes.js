const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrapAll } = require('../utils/asyncHandler');
const ctrl = wrapAll(require('../controllers/adminController'));

router.post('/login', ctrl.login); // no register route exists — see seed/createAdmin.js

const adminOnly = [requireAuth, requireRole('admin')];

router.get('/registrations', ...adminOnly, ctrl.listRegistrations);
router.get('/registrations/export', ...adminOnly, ctrl.exportRegistrations);
router.post('/registrations/:id/approve', ...adminOnly, ctrl.approveAndGenerateVoterId);
router.post('/registrations/:id/reject', ...adminOnly, ctrl.rejectRegistration);

router.get('/elections', ...adminOnly, ctrl.listElections);
router.get('/elections/:id', ...adminOnly, ctrl.getElectionDetail);
router.post('/elections', ...adminOnly, ctrl.createElection);
router.put('/elections/:id', ...adminOnly, ctrl.updateElection);
router.delete('/elections/:id', ...adminOnly, ctrl.deleteElection);

const candidateUpload = upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'symbol', maxCount: 1 }]);
router.post('/elections/:id/candidates', ...adminOnly, candidateUpload, ctrl.addCandidate);
router.put('/candidates/:id', ...adminOnly, candidateUpload, ctrl.updateCandidate);
router.delete('/candidates/:id', ...adminOnly, ctrl.deleteCandidate);

router.post('/elections/:id/open', ...adminOnly, ctrl.openElection);
router.post('/elections/:id/close', ...adminOnly, ctrl.closeElection);
router.get('/elections/:id/tally', ...adminOnly, ctrl.getTally);
router.get('/elections/:id/export', ...adminOnly, ctrl.exportTally);
router.post('/elections/:id/publish', ...adminOnly, ctrl.publishResults);

router.get('/update-requests', ...adminOnly, ctrl.listUpdateRequests);
router.post('/update-requests/:id/approve', ...adminOnly, ctrl.approveUpdateRequest);
router.post('/update-requests/:id/reject', ...adminOnly, ctrl.rejectUpdateRequest);

router.get('/stats', ...adminOnly, ctrl.getStats);
router.get('/audit-logs', ...adminOnly, ctrl.listAuditLogs);

module.exports = router;

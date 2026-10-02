const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrapAll } = require('../utils/asyncHandler');
const ctrl = wrapAll(require('../controllers/electionController'));

const voterOnly = [requireAuth, requireRole('voter')];

router.get('/', ...voterOnly, ctrl.listElectionsForVoter);
router.get('/:id/candidates', ...voterOnly, ctrl.getCandidates);
router.post('/:id/vote', ...voterOnly, ctrl.castVote);
router.get('/:id/results', ...voterOnly, ctrl.getResults); // public results page can relax this later

module.exports = router;

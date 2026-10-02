const express = require('express');
const router = express.Router();
const { wrapAll } = require('../utils/asyncHandler');
const ctrl = wrapAll(require('../controllers/electionController'));

// No login required — anyone can read results the admin has published.
router.get('/elections', ctrl.listPublishedElections);
router.get('/elections/:id/results', ctrl.getPublicResults);

module.exports = router;

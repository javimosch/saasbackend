const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const featureFlagsController = require('../controllers/featureFlags.controller');

router.get('/public', featureFlagsController.getPublicFlags);
router.get('/', authenticate, featureFlagsController.getEvaluatedFlags);

module.exports = router;

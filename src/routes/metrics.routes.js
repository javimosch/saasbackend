const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metrics.controller');
const asyncHandler = require('../utils/asyncHandler');

router.post('/track', asyncHandler(metricsController.track));
router.get('/impact', asyncHandler(metricsController.getImpact));

module.exports = router;

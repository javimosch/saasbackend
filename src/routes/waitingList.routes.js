const express = require('express');
const router = express.Router();
const waitingListController = require('../controllers/waitingList.controller');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/waiting-list/subscribe - Subscribe to waiting list
router.post('/subscribe', asyncHandler(waitingListController.subscribe));

// GET /api/waiting-list/stats - Get waiting list statistics (public)
router.get('/stats', asyncHandler(waitingListController.getStats));

module.exports = router;

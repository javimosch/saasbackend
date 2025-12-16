const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');
const waitingListController = require('../controllers/waitingList.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', basicAuth, asyncHandler(waitingListController.adminList));

module.exports = router;

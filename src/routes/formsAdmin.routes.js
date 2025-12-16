const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');
const formsController = require('../controllers/forms.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', basicAuth, asyncHandler(formsController.adminList));

module.exports = router;

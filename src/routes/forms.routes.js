const express = require('express');
const router = express.Router();
const formsController = require('../controllers/forms.controller');
const asyncHandler = require('../utils/asyncHandler');

router.post('/submit', asyncHandler(formsController.submit));

module.exports = router;

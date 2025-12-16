const express = require('express');
const router = express.Router();

const i18nController = require('../controllers/i18n.controller');

router.get('/bundle', i18nController.getBundle);

module.exports = router;

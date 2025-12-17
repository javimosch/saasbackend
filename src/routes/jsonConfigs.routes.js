const express = require('express');
const router = express.Router();

const jsonConfigsController = require('../controllers/jsonConfigs.controller');

router.get('/:slug', jsonConfigsController.getPublic);

module.exports = router;

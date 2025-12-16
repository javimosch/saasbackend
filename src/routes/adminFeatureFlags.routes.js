const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');
const adminFeatureFlagsController = require('../controllers/adminFeatureFlags.controller');

router.get('/', basicAuth, adminFeatureFlagsController.listFlags);
router.get('/:key', basicAuth, adminFeatureFlagsController.getFlag);
router.post('/', basicAuth, adminFeatureFlagsController.createFlag);
router.put('/:key', basicAuth, adminFeatureFlagsController.updateFlag);
router.delete('/:key', basicAuth, adminFeatureFlagsController.deleteFlag);

module.exports = router;

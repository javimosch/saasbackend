const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');

const adminJsonConfigsController = require('../controllers/adminJsonConfigs.controller');

router.get('/', basicAuth, adminJsonConfigsController.list);
router.get('/:id', basicAuth, adminJsonConfigsController.get);
router.post('/', basicAuth, adminJsonConfigsController.create);
router.put('/:id', basicAuth, adminJsonConfigsController.update);
router.post('/:id/regenerate-slug', basicAuth, adminJsonConfigsController.regenerateSlug);
router.post('/:id/clear-cache', basicAuth, adminJsonConfigsController.clearCache);
router.delete('/:id', basicAuth, adminJsonConfigsController.remove);

module.exports = router;

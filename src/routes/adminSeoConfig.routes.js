const express = require('express');
const router = express.Router();

const { basicAuth } = require('../middleware/auth');
const adminSeoConfigController = require('../controllers/adminSeoConfig.controller');

router.get('/', basicAuth, adminSeoConfigController.get);
router.put('/', basicAuth, adminSeoConfigController.update);

// SEO Config helpers
router.get('/ai/views', basicAuth, adminSeoConfigController.seoConfigAiListViews);
router.post('/ai/generate-entry', basicAuth, adminSeoConfigController.seoConfigAiGenerateEntry);
router.post('/ai/improve-entry', basicAuth, adminSeoConfigController.seoConfigAiImproveEntry);
router.post('/pages/apply-entry', basicAuth, adminSeoConfigController.seoConfigApplyEntry);

router.put('/og/svg', basicAuth, adminSeoConfigController.updateOgSvg);
router.post('/og/generate-png', basicAuth, adminSeoConfigController.generateOgPng);
router.post('/ai/edit-svg', basicAuth, adminSeoConfigController.aiEditSvg);

module.exports = router;

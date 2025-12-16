const express = require('express');
const router = express.Router();

const { basicAuth } = require('../middleware/auth');
const stripeAdminController = require('../controllers/stripeAdmin.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/status', basicAuth, asyncHandler(stripeAdminController.getStripeStatus));
router.get('/catalog', basicAuth, asyncHandler(stripeAdminController.listCatalog));
router.get('/catalog/:id', basicAuth, asyncHandler(stripeAdminController.getCatalogItem));
router.post('/catalog/upsert', basicAuth, asyncHandler(stripeAdminController.upsertCatalogItem));
router.post('/catalog/import', basicAuth, asyncHandler(stripeAdminController.importStripePrice));
router.post('/catalog/:id/deactivate', basicAuth, asyncHandler(stripeAdminController.deactivateCatalogItem));
router.post('/catalog/:id/activate', basicAuth, asyncHandler(stripeAdminController.activateCatalogItem));
router.delete('/catalog/:id', basicAuth, asyncHandler(stripeAdminController.deleteCatalogItem));
router.get('/products', basicAuth, asyncHandler(stripeAdminController.listStripeProducts));
router.get('/prices', basicAuth, asyncHandler(stripeAdminController.listStripePrices));

module.exports = router;

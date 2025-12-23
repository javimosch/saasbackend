const mongoose = require('mongoose');
const StripeCatalogItem = require('../models/StripeCatalogItem');
const stripeHelper = require('../services/stripeHelper.service');
const { createAuditEvent, getBasicAuthActor } = require('../services/audit.service');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function parseLimit(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

function parseOffset(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

exports.getStripeStatus = async (req, res) => {
  try {
    const configured = await stripeHelper.isStripeConfigured();
    const catalogCount = await StripeCatalogItem.countDocuments({});
    const activeCount = await StripeCatalogItem.countDocuments({ active: true });

    return res.json({
      configured,
      catalogCount,
      activeCount,
      envPriceIdCreator: process.env.STRIPE_PRICE_ID_CREATOR ? '(set)' : '(not set)',
      envPriceIdPro: process.env.STRIPE_PRICE_ID_PRO ? '(set)' : '(not set)'
    });
  } catch (error) {
    console.error('Stripe status error:', error);
    return res.status(500).json({ error: 'Failed to get Stripe status' });
  }
};

exports.listCatalog = async (req, res) => {
  try {
    const { active, billingType, planKey, limit, offset } = req.query;

    const parsedLimit = parseLimit(limit);
    const parsedOffset = parseOffset(offset);

    const query = {};
    if (active === 'true') query.active = true;
    if (active === 'false') query.active = false;
    if (billingType) query.billingType = String(billingType);
    if (planKey) query.planKey = String(planKey);

    const items = await StripeCatalogItem.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .skip(parsedOffset)
      .lean();

    const total = await StripeCatalogItem.countDocuments(query);

    return res.json({
      items,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    console.error('Catalog list error:', error);
    return res.status(500).json({ error: 'Failed to list catalog' });
  }
};

exports.getCatalogItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: 'Invalid catalog item ID' });
    }

    const item = await StripeCatalogItem.findById(id).lean();
    if (!item) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }

    return res.json({ item });
  } catch (error) {
    console.error('Catalog get error:', error);
    return res.status(500).json({ error: 'Failed to get catalog item' });
  }
};

exports.upsertCatalogItem = async (req, res) => {
  try {
    if (!(await stripeHelper.isStripeConfigured())) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    const {
      productName,
      productDescription,
      planKey,
      displayName,
      billingType,
      currency,
      unitAmount,
      interval,
      intervalCount,
      metadata,
      existingProductId
    } = req.body;

    if (!productName || !planKey || !displayName || !billingType || unitAmount === undefined) {
      return res.status(400).json({
        error: 'productName, planKey, displayName, billingType, and unitAmount are required'
      });
    }

    if (!['subscription', 'one_time'].includes(billingType)) {
      return res.status(400).json({ error: 'billingType must be subscription or one_time' });
    }

    if (billingType === 'subscription' && !interval) {
      return res.status(400).json({ error: 'interval is required for subscription billing' });
    }

    const actor = getBasicAuthActor(req);

    const result = await stripeHelper.upsertStripeProductAndPrice({
      productName: String(productName),
      productDescription: productDescription ? String(productDescription) : '',
      planKey: String(planKey).trim(),
      displayName: String(displayName).trim(),
      billingType: String(billingType),
      currency: currency ? String(currency).toLowerCase() : 'usd',
      unitAmount: parseInt(unitAmount, 10),
      interval: interval ? String(interval) : null,
      intervalCount: intervalCount ? parseInt(intervalCount, 10) : 1,
      metadata: metadata || {},
      existingProductId: existingProductId || null,
      adminId: actor.actorId
    });

    await createAuditEvent({
      ...actor,
      action: 'admin.stripe.catalog.upsert',
      entityType: 'StripeCatalogItem',
      entityId: String(result.catalogItem._id),
      before: null,
      after: result.catalogItem,
      meta: { stripeProductId: result.product.id, stripePriceId: result.price.id }
    });

    return res.status(201).json({
      message: 'Catalog item created/updated',
      catalogItem: result.catalogItem,
      stripeProduct: { id: result.product.id, name: result.product.name },
      stripePrice: { id: result.price.id, unitAmount: result.price.unit_amount }
    });
  } catch (error) {
    console.error('Catalog upsert error:', error);
    return res.status(500).json({ error: error.message || 'Failed to upsert catalog item' });
  }
};

exports.importStripePrice = async (req, res) => {
  try {
    if (!(await stripeHelper.isStripeConfigured())) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    const { stripePriceId, planKey, displayName } = req.body;

    if (!stripePriceId || !planKey) {
      return res.status(400).json({ error: 'stripePriceId and planKey are required' });
    }

    const actor = getBasicAuthActor(req);

    const result = await stripeHelper.importStripePrice(
      String(stripePriceId),
      String(planKey).trim(),
      displayName ? String(displayName).trim() : null,
      actor.actorId
    );

    await createAuditEvent({
      ...actor,
      action: 'admin.stripe.catalog.import',
      entityType: 'StripeCatalogItem',
      entityId: String(result.catalogItem._id),
      before: null,
      after: result.catalogItem,
      meta: { stripePriceId }
    });

    return res.status(201).json({
      message: 'Price imported successfully',
      catalogItem: result.catalogItem
    });
  } catch (error) {
    console.error('Import price error:', error);
    return res.status(500).json({ error: error.message || 'Failed to import price' });
  }
};

exports.deactivateCatalogItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: 'Invalid catalog item ID' });
    }

    const item = await StripeCatalogItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }

    const before = item.toObject();
    const actor = getBasicAuthActor(req);

    item.active = false;
    item.updatedByAdminId = actor.actorId;
    await item.save();

    await createAuditEvent({
      ...actor,
      action: 'admin.stripe.catalog.deactivate',
      entityType: 'StripeCatalogItem',
      entityId: String(item._id),
      before,
      after: item.toObject(),
      meta: null
    });

    return res.json({ message: 'Catalog item deactivated', item });
  } catch (error) {
    console.error('Deactivate error:', error);
    return res.status(500).json({ error: 'Failed to deactivate catalog item' });
  }
};

exports.activateCatalogItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: 'Invalid catalog item ID' });
    }

    const item = await StripeCatalogItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }

    const before = item.toObject();
    const actor = getBasicAuthActor(req);

    item.active = true;
    item.updatedByAdminId = actor.actorId;
    await item.save();

    await createAuditEvent({
      ...actor,
      action: 'admin.stripe.catalog.activate',
      entityType: 'StripeCatalogItem',
      entityId: String(item._id),
      before,
      after: item.toObject(),
      meta: null
    });

    return res.json({ message: 'Catalog item activated', item });
  } catch (error) {
    console.error('Activate error:', error);
    return res.status(500).json({ error: 'Failed to activate catalog item' });
  }
};

exports.deleteCatalogItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: 'Invalid catalog item ID' });
    }

    const item = await StripeCatalogItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }

    const before = item.toObject();
    const actor = getBasicAuthActor(req);

    await StripeCatalogItem.deleteOne({ _id: id });

    await createAuditEvent({
      ...actor,
      action: 'admin.stripe.catalog.delete',
      entityType: 'StripeCatalogItem',
      entityId: String(id),
      before,
      after: null,
      meta: null
    });

    return res.json({ message: 'Catalog item deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete catalog item' });
  }
};

exports.listStripeProducts = async (req, res) => {
  try {
    if (!(await stripeHelper.isStripeConfigured())) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    const stripe = await stripeHelper.getStripeClient();
    const { limit = 20, starting_after } = req.query;

    const params = {
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      active: true
    };
    if (starting_after) params.starting_after = starting_after;

    const products = await stripe.products.list(params);

    return res.json({
      products: products.data,
      hasMore: products.has_more
    });
  } catch (error) {
    console.error('List Stripe products error:', error);
    return res.status(500).json({ error: error.message || 'Failed to list Stripe products' });
  }
};

exports.listStripePrices = async (req, res) => {
  try {
    if (!(await stripeHelper.isStripeConfigured())) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    const stripe = await stripeHelper.getStripeClient();
    const { product, limit = 20, starting_after } = req.query;

    const params = {
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      active: true,
      expand: ['data.product']
    };
    if (product) params.product = product;
    if (starting_after) params.starting_after = starting_after;

    const prices = await stripe.prices.list(params);

    const catalogPriceIds = await StripeCatalogItem.find({}).select('stripePriceId').lean();
    const mappedIds = new Set(catalogPriceIds.map(c => c.stripePriceId));

    const pricesWithMapping = prices.data.map(p => ({
      ...p,
      _isMapped: mappedIds.has(p.id)
    }));

    return res.json({
      prices: pricesWithMapping,
      hasMore: prices.has_more
    });
  } catch (error) {
    console.error('List Stripe prices error:', error);
    return res.status(500).json({ error: error.message || 'Failed to list Stripe prices' });
  }
};

exports.syncEnvFromCatalog = async (req, res) => {
  try {
    const items = await StripeCatalogItem.find({ active: true })
      .sort({ createdAt: -1 })
      .lean();

    const applied = [];

    for (const item of items) {
      const envVar = String(item.planKey || '').trim();
      if (!envVar) continue;

      process.env[envVar] = item.stripePriceId;
      applied.push({
        envVar,
        stripePriceId: item.stripePriceId,
      });
    }

    return res.json({
      applied,
      totalActive: items.length,
    });
  } catch (error) {
    console.error('Stripe env sync error:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync env from catalog' });
  }
};


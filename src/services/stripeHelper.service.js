const StripeCatalogItem = require('../models/StripeCatalogItem');
const globalSettingsService = require('./globalSettings.service');

let stripeClient = null;
let stripeClientKey = null;

async function getStripeSecretKey() {
  const envKey = process.env.STRIPE_SECRET_KEY || null;
  if (envKey) return envKey;

  try {
    const settingKey = await globalSettingsService.getSettingValue(
      'STRIPE_SECRET_KEY',
      null,
    );
    return settingKey || null;
  } catch (error) {
    console.error('Error reading STRIPE_SECRET_KEY from settings:', error);
    return null;
  }
}

async function isStripeConfigured() {
  const key = await getStripeSecretKey();
  return !!(key && key.startsWith('sk_'));
}

async function getStripeClient() {
  const key = await getStripeSecretKey();
  if (!key || !key.startsWith('sk_')) {
    return null;
  }

  if (!stripeClient || stripeClientKey !== key) {
    stripeClient = require('stripe')(key);
    stripeClientKey = key;
  }

  return stripeClient;
}

function resetStripeClient() {
  stripeClient = null;
  stripeClientKey = null;
}

async function resolvePlanKeyFromPriceId(priceId) {
  if (!priceId) {
    return 'free';
  }

  try {
    const catalogItem = await StripeCatalogItem.findOne({
      stripePriceId: priceId,
      active: true
    }).lean();

    if (catalogItem) {
      return catalogItem.planKey;
    }
  } catch (error) {
    console.error('Error looking up catalog item:', error);
  }

  if (priceId === process.env.STRIPE_PRICE_ID_CREATOR) {
    return 'creator';
  }
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    return 'pro';
  }

  console.warn(`Unknown price ID: ${priceId}, defaulting to 'creator' for active subscription`);
  return 'creator';
}

async function findExistingPrice(stripe, productId, currency, unitAmount, recurring) {
  try {
    const prices = await stripe.prices.list({
      product: productId,
      currency: currency,
      active: true,
      limit: 100
    });

    for (const price of prices.data) {
      if (price.unit_amount !== unitAmount) continue;

      if (recurring) {
        if (price.type === 'recurring' &&
            price.recurring?.interval === recurring.interval &&
            (price.recurring?.interval_count || 1) === (recurring.interval_count || 1)) {
          return price;
        }
      } else {
        if (price.type === 'one_time') {
          return price;
        }
      }
    }
  } catch (error) {
    console.error('Error searching for existing price:', error);
  }

  return null;
}

async function upsertStripeProductAndPrice({
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
  existingProductId,
  adminId
}) {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  let product;
  if (existingProductId) {
    product = await stripe.products.update(existingProductId, {
      name: productName,
      description: productDescription || undefined,
      metadata: { planKey, ...metadata }
    });
  } else {
    product = await stripe.products.create({
      name: productName,
      description: productDescription || undefined,
      metadata: { planKey, ...metadata }
    });
  }

  const recurring = billingType === 'subscription' ? {
    interval: interval || 'month',
    interval_count: intervalCount || 1
  } : null;

  let price = await findExistingPrice(stripe, product.id, currency, unitAmount, recurring);

  if (!price) {
    const priceData = {
      product: product.id,
      currency: currency || 'usd',
      unit_amount: unitAmount,
      metadata: { planKey }
    };

    if (recurring) {
      priceData.recurring = recurring;
    }

    price = await stripe.prices.create(priceData);
  }

  const catalogItem = await StripeCatalogItem.findOneAndUpdate(
    { stripePriceId: price.id },
    {
      stripeProductId: product.id,
      stripePriceId: price.id,
      planKey,
      displayName,
      description: productDescription || '',
      billingType,
      currency: currency || 'usd',
      unitAmount,
      interval: recurring?.interval || null,
      intervalCount: recurring?.interval_count || 1,
      active: true,
      metadata,
      updatedByAdminId: adminId
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  if (!catalogItem.createdByAdminId) {
    catalogItem.createdByAdminId = adminId;
    await catalogItem.save();
  }

  return {
    product,
    price,
    catalogItem
  };
}

async function importStripePrice(stripePriceId, planKey, displayName, adminId) {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const price = await stripe.prices.retrieve(stripePriceId, {
    expand: ['product']
  });

  if (!price) {
    throw new Error('Price not found in Stripe');
  }

  const product = price.product;
  const productId = typeof product === 'string' ? product : product.id;
  const productName = typeof product === 'object' ? product.name : '';

  const billingType = price.type === 'recurring' ? 'subscription' : 'one_time';

  const catalogItem = await StripeCatalogItem.findOneAndUpdate(
    { stripePriceId: price.id },
    {
      stripeProductId: productId,
      stripePriceId: price.id,
      planKey,
      displayName: displayName || productName || planKey,
      description: typeof product === 'object' ? (product.description || '') : '',
      billingType,
      currency: price.currency,
      unitAmount: price.unit_amount,
      interval: price.recurring?.interval || null,
      intervalCount: price.recurring?.interval_count || 1,
      active: price.active,
      metadata: price.metadata || {},
      updatedByAdminId: adminId
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  if (!catalogItem.createdByAdminId) {
    catalogItem.createdByAdminId = adminId;
    await catalogItem.save();
  }

  return {
    price,
    product,
    catalogItem
  };
}

module.exports = {
  getStripeSecretKey,
  isStripeConfigured,
  getStripeClient,
  resetStripeClient,
  resolvePlanKeyFromPriceId,
  findExistingPrice,
  upsertStripeProductAndPrice,
  importStripePrice
};

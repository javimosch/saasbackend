# Admin Stripe Pricing Management

## Overview

This feature provides an admin interface to manage Stripe products and prices directly from saasbackend, without needing the Stripe Dashboard. It maintains **full backward compatibility** with existing webhook and reconciliation flows.

## Features

- **Create Products & Prices**: Create new Stripe products and prices directly from admin UI
- **Import Existing Prices**: Import existing Stripe prices and assign plan keys
- **Catalog Mapping**: Map Stripe `priceId` → `planKey` for webhook plan assignment
- **Backward Compatible**: Existing env-based price mappings (`STRIPE_PRICE_ID_CREATOR`, `STRIPE_PRICE_ID_PRO`) continue to work

---

## Backward Compatibility

### Existing deployments continue to work

The plan resolution follows this priority order:

1. **Catalog mapping** (new): Lookup `StripeCatalogItem` by `stripePriceId`
2. **Legacy env mapping** (existing): Check `STRIPE_PRICE_ID_CREATOR` and `STRIPE_PRICE_ID_PRO`
3. **Fallback**: Default to `creator` for unknown active subscriptions (preserves current behavior)

This means:
- **Zero changes required** for existing production environments
- Webhooks and reconciliation work exactly as before
- You can gradually adopt catalog-based mapping

### Migration path for existing environments

1. **Phase 1**: Deploy code (no catalog mappings yet) → webhooks still use env mapping
2. **Phase 2**: Use admin UI to import existing prices and assign `planKey`
3. **Phase 3**: Start creating new prices from admin UI
4. **Phase 4** (optional): Stop setting env price IDs in new environments

---

## Data Model

### StripeCatalogItem

```javascript
{
  stripeProductId: String,    // Stripe product ID (prod_...)
  stripePriceId: String,      // Stripe price ID (price_...) - unique
  planKey: String,            // Your plan label (e.g., "pro", "starter", "team_monthly")
  displayName: String,        // Human-readable name
  description: String,        // Optional description
  billingType: String,        // "subscription" | "one_time"
  currency: String,           // "usd", "eur", etc.
  unitAmount: Number,         // Price in cents
  interval: String,           // "month", "year", "week", "day" (for subscriptions)
  intervalCount: Number,      // e.g., 1 for monthly, 3 for quarterly
  active: Boolean,            // Whether this mapping is active
  metadata: Object,           // Additional data
  createdByAdminId: String,   // Admin who created it
  updatedByAdminId: String    // Admin who last updated it
}
```

---

## API Endpoints

All endpoints require **Basic Auth** (admin credentials).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stripe/status` | Check Stripe config status |
| GET | `/api/admin/stripe/catalog` | List catalog items |
| GET | `/api/admin/stripe/catalog/:id` | Get single catalog item |
| POST | `/api/admin/stripe/catalog/upsert` | Create product + price in Stripe and catalog |
| POST | `/api/admin/stripe/catalog/import` | Import existing Stripe price into catalog |
| POST | `/api/admin/stripe/catalog/:id/deactivate` | Deactivate catalog item |
| POST | `/api/admin/stripe/catalog/:id/activate` | Activate catalog item |
| DELETE | `/api/admin/stripe/catalog/:id` | Delete catalog item (not from Stripe) |
| GET | `/api/admin/stripe/products` | List Stripe products (live) |
| GET | `/api/admin/stripe/prices` | List Stripe prices (live) |

### Create/Upsert Example

```json
POST /api/admin/stripe/catalog/upsert
{
  "productName": "Pro Plan",
  "productDescription": "Access to all features",
  "planKey": "pro_monthly",
  "displayName": "Pro (Monthly)",
  "billingType": "subscription",
  "currency": "usd",
  "unitAmount": 1999,
  "interval": "month"
}
```

### Import Existing Price Example

```json
POST /api/admin/stripe/catalog/import
{
  "stripePriceId": "price_1ABC123...",
  "planKey": "pro",
  "displayName": "Pro Plan"
}
```

---

## Admin View

Access at `/admin/stripe-pricing` (requires admin basic auth).

### Features

- **Status display**: Shows if Stripe is configured, catalog counts, env var status
- **Create form**: Create new Stripe products and prices
- **Import form**: Import existing Stripe prices by ID
- **Catalog table**: View, activate/deactivate, delete catalog items
- **Browse Stripe**: Modal to browse live Stripe prices and quick-import

### Gating

If `STRIPE_SECRET_KEY` is not set, the view displays a "Stripe Not Configured" message with setup instructions.

---

## User Plan Changes

### currentPlan is now free-text

The `User.currentPlan` field is no longer restricted to `['free', 'creator', 'pro']`. It accepts any string value (max 100 chars).

This enables:
- Custom plan names: `"starter"`, `"team_annual"`, `"lifetime_gold"`
- Integration with any Stripe pricing structure
- Backward compatible: existing values (`free`, `creator`, `pro`) remain valid

### Webhook plan assignment

When a webhook event is processed (subscription created/updated, checkout completed), the user's `currentPlan` is set based on the Stripe price:

```
priceId → catalog lookup → planKey
        ↓ (if not found)
priceId → env var check → "creator" or "pro"
        ↓ (if not found)
default to "creator" (preserves existing behavior)
```

---

## Configuration

### Required

```bash
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
```

### Optional (legacy, still supported)

```bash
STRIPE_PRICE_ID_CREATOR=price_...  # Maps to planKey "creator"
STRIPE_PRICE_ID_PRO=price_...      # Maps to planKey "pro"
```

---

## Security

- All admin endpoints protected by `basicAuth`
- Admin actions logged via `audit.service.js`
- Stripe client lazily initialized (no crash if unconfigured)
- Catalog deletion does not delete from Stripe (safe)

---

## Files

### New Files

- `src/models/StripeCatalogItem.js` - Catalog item model
- `src/services/stripeHelper.service.js` - Stripe client, gating, catalog lookup
- `src/controllers/stripeAdmin.controller.js` - Admin API endpoints
- `src/routes/stripeAdmin.routes.js` - Admin routes
- `views/admin-stripe-pricing.ejs` - Admin UI

### Modified Files

- `src/models/User.js` - `currentPlan` enum removed (now free-text)
- `src/services/stripe.service.js` - Uses `stripeHelper` for plan resolution
- `src/controllers/userAdmin.controller.js` - Free-text plan validation
- `src/middleware.js` - Routes mounted
- `index.js` - Routes mounted (standalone)
- `src/admin/endpointRegistry.js` - New endpoints registered
- `views/partials/admin-test-sidebar.ejs` - Sidebar link added

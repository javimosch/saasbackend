const mongoose = require('mongoose');

const stripeCatalogItemSchema = new mongoose.Schema({
  stripeProductId: {
    type: String,
    required: true,
    index: true
  },
  stripePriceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  planKey: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  billingType: {
    type: String,
    enum: ['subscription', 'one_time'],
    required: true
  },
  currency: {
    type: String,
    required: true,
    lowercase: true,
    default: 'usd'
  },
  unitAmount: {
    type: Number,
    required: true
  },
  interval: {
    type: String,
    enum: ['month', 'year', 'week', 'day', null],
    default: null
  },
  intervalCount: {
    type: Number,
    default: 1
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdByAdminId: {
    type: String
  },
  updatedByAdminId: {
    type: String
  }
}, {
  timestamps: true
});

stripeCatalogItemSchema.index({ planKey: 1, active: 1 });
stripeCatalogItemSchema.index({ stripeProductId: 1, active: 1 });

module.exports = mongoose.model('StripeCatalogItem', stripeCatalogItemSchema);

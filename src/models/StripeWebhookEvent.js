const mongoose = require('mongoose');

const stripeWebhookEventSchema = new mongoose.Schema({
  stripeEventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  data: {
    type: Object,
    required: true
  },
  previousAttributes: {
    type: Object
  },
  api_version: {
    type: String
  },
  request: {
    type: Object
  },
  status: {
    type: String,
    enum: ['received', 'processed', 'failed', 'skipped'],
    default: 'received',
    index: true
  },
  processingErrors: [{
    message: String,
    timestamp: Date
  }],
  retryCount: {
    type: Number,
    default: 0
  },
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

stripeWebhookEventSchema.index({ status: 1, receivedAt: 1 });
stripeWebhookEventSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model('StripeWebhookEvent', stripeWebhookEventSchema);

const StripeWebhookEvent = require("../models/StripeWebhookEvent");
const stripeService = require("../services/stripe.service");

const MAX_RETRIES = 3;

async function retryFailedWebhooks(options = {}) {
  const { limit = 10, maxRetries = MAX_RETRIES } = options;

  const failedEvents = await StripeWebhookEvent.find({
    status: "failed",
    retryCount: { $lt: maxRetries }
  })
    .sort({ receivedAt: 1 })
    .limit(limit);

  const results = {
    total: failedEvents.length,
    succeeded: 0,
    failed: 0,
    errors: []
  };

  for (const event of failedEvents) {
    try {
      await processWebhookEvent(event);
      
      event.status = "processed";
      event.processedAt = new Date();
      await event.save();
      
      results.succeeded++;
      console.log(`Retry succeeded for event ${event.stripeEventId}`);
    } catch (err) {
      event.retryCount++;
      event.processingErrors.push({
        message: err.message,
        timestamp: new Date()
      });
      
      if (event.retryCount >= maxRetries) {
        console.error(`Max retries reached for event ${event.stripeEventId}`);
      }
      
      await event.save();
      results.failed++;
      results.errors.push({
        eventId: event.stripeEventId,
        error: err.message
      });
    }
  }

  return results;
}

async function processWebhookEvent(webhookEvent) {
  const eventData = webhookEvent.data;
  const previousAttributes = webhookEvent.previousAttributes;

  switch (webhookEvent.eventType) {
    case "checkout.session.completed":
      await stripeService.handleCheckoutSessionCompleted(eventData);
      break;
    
    case "customer.subscription.created":
      await stripeService.handleSubscriptionCreated(eventData);
      break;
    
    case "customer.subscription.updated":
      await stripeService.handleSubscriptionUpdated(eventData, previousAttributes);
      break;
    
    case "customer.subscription.deleted":
      await stripeService.handleSubscriptionDeleted(eventData);
      break;
    
    case "invoice.payment_succeeded":
      await stripeService.handleInvoicePaymentSucceeded(eventData);
      break;
    
    case "invoice.payment_failed":
      await stripeService.handleInvoicePaymentFailed(eventData);
      break;
    
    default:
      console.log(`Unhandled event type: ${webhookEvent.eventType}`);
  }
}

module.exports = {
  retryFailedWebhooks,
  processWebhookEvent
};

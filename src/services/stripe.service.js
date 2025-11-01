const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

class StripeService {
  async handleCheckoutSessionCompleted(session) {
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    const userId = session.metadata?.userId;

    if (!customerId) {
      throw new Error("No customer ID in session");
    }

    const user = await User.findOne({ stripeCustomerId: customerId });
    if (!user) {
      console.warn(`User not found for customer ${customerId}, userId in metadata: ${userId}`);
      return;
    }

    if (subscriptionId) {
      user.stripeSubscriptionId = subscriptionId;
    }

    await user.save();
    console.log(`Checkout completed for user ${user._id}, subscription: ${subscriptionId}`);
  }

  async handleSubscriptionCreated(subscription) {
    const customerId = subscription.customer;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (!user) {
      console.warn(`User not found for customer ${customerId}`);
      return;
    }

    user.stripeSubscriptionId = subscription.id;
    
    const statusMapping = this.getStatusMapping();
    user.subscriptionStatus = statusMapping[subscription.status] || subscription.status;

    await user.save();
    console.log(`Subscription created for user ${user._id}: ${subscription.id}, status: ${user.subscriptionStatus}`);
  }

  async handleSubscriptionUpdated(subscription, previousAttributes) {
    const customerId = subscription.customer;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (!user) {
      console.warn(`User not found for customer ${customerId}`);
      return;
    }

    user.stripeSubscriptionId = subscription.id;
    
    const statusMapping = this.getStatusMapping();
    const newStatus = statusMapping[subscription.status] || subscription.status;
    const oldStatus = user.subscriptionStatus;

    user.subscriptionStatus = newStatus;

    await user.save();
    
    if (oldStatus !== newStatus) {
      console.log(`Subscription updated for user ${user._id}: ${oldStatus} -> ${newStatus}`);
    }
  }

  async handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (!user) {
      console.warn(`User not found for customer ${customerId}`);
      return;
    }

    user.subscriptionStatus = "cancelled";
    await user.save();
    console.log(`Subscription deleted for user ${user._id}`);
  }

  async handleInvoicePaymentSucceeded(invoice) {
    const customerId = invoice.customer;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (!user) {
      console.warn(`User not found for customer ${customerId}`);
      return;
    }

    if (user.subscriptionStatus !== "active") {
      user.subscriptionStatus = "active";
      await user.save();
      console.log(`Invoice paid for user ${user._id}, status updated to active`);
    }
  }

  async handleInvoicePaymentFailed(invoice) {
    const customerId = invoice.customer;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (!user) {
      console.warn(`User not found for customer ${customerId}`);
      return;
    }

    user.subscriptionStatus = "past_due";
    await user.save();
    console.log(`Invoice payment failed for user ${user._id}, status updated to past_due`);
  }

  getStatusMapping() {
    return {
      'active': 'active',
      'past_due': 'past_due',
      'unpaid': 'unpaid',
      'canceled': 'cancelled',
      'incomplete': 'incomplete',
      'incomplete_expired': 'incomplete_expired',
      'trialing': 'trialing'
    };
  }
}

module.exports = new StripeService();

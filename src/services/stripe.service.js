const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

class StripeService {
  async handleCheckoutSessionCompleted(session) {
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    const userId = session.metadata?.userId;
    const billingMode = session.metadata?.billingMode || session.mode;

    if (!customerId) {
      throw new Error("No customer ID in session");
    }

    let user = await User.findOne({ stripeCustomerId: customerId });
    if (!user && userId) {
      user = await User.findById(userId);
    }

    if (!user) {
      console.warn(`User not found for customer ${customerId}, userId in metadata: ${userId}`);
      return;
    }

    if (subscriptionId) {
      user.stripeSubscriptionId = subscriptionId;
      
      // Update plan based on subscription
      await this.updateUserPlanFromSubscription(user, subscriptionId);
    }

    // For one-off (payment mode) checkouts, mark the user as active immediately
    if (billingMode === "payment" || session.mode === "payment") {
      user.subscriptionStatus = "active";
    }

    await user.save();
    console.log(
      `Checkout completed for user ${user._id}, subscription: ${subscriptionId || "none"}, mode: ${session.mode}, plan: ${user.currentPlan}`
    );
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

    // Update plan based on subscription
    await this.updateUserPlanFromSubscription(user, subscription.id);

    await user.save();
    console.log(`Subscription created for user ${user._id}: ${subscription.id}, status: ${user.subscriptionStatus}, plan: ${user.currentPlan}`);
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

    // Update plan based on subscription
    await this.updateUserPlanFromSubscription(user, subscription.id);

    await user.save();
    
    if (oldStatus !== newStatus) {
      console.log(`Subscription updated for user ${user._id}: ${oldStatus} -> ${newStatus}, plan: ${user.currentPlan}`);
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
    user.currentPlan = "free"; // Reset to free when subscription is deleted

    await user.save();
    console.log(`Subscription deleted for user ${user._id}, plan reset to free`);
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
      
      // Update plan when invoice is paid
      if (user.stripeSubscriptionId) {
        await this.updateUserPlanFromSubscription(user, user.stripeSubscriptionId);
      }
      
      await user.save();
      console.log(`Invoice paid for user ${user._id}, status updated to active, plan: ${user.currentPlan}`);
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

  /**
   * Update user's currentPlan based on their Stripe subscription
   */
  async updateUserPlanFromSubscription(user, subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      
      let plan = 'free';
      
      if (priceId === process.env.STRIPE_PRICE_ID_CREATOR) {
        plan = 'creator';
      } else if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
        plan = 'pro';
      } else {
        console.warn(`Unknown price ID: ${priceId} for subscription ${subscriptionId}`);
        plan = 'creator'; // Default to creator for unknown active subscriptions
      }
      
      user.currentPlan = plan;
      console.log(`Updated user ${user.email} plan to ${plan} based on price ID ${priceId}`);
      
    } catch (error) {
      console.error('Error updating user plan from subscription:', error);
      // Don't change plan if we can't verify
    }
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

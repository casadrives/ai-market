const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');

// PayPal client configuration
let environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
);
let paypalClient = new paypal.core.PayPalHttpClient(environment);

// PayPal merchant configuration
const PAYPAL_MERCHANT_EMAIL = 'info@panterastores.com';
const PAYPAL_MERCHANT_ID = process.env.PAYPAL_MERCHANT_ID;

class PaymentService {
    // Subscription Plans
    static PLANS = {
        STARTER: {
            id: 'starter',
            name: 'Starter Plan',
            price: 29.99,
            credits: 100,
            features: [
                '100 AI Credits/month',
                'Basic Analytics',
                'Email Support',
                '5 Active Campaigns'
            ]
        },
        PROFESSIONAL: {
            id: 'professional',
            name: 'Professional Plan',
            price: 79.99,
            credits: 300,
            features: [
                '300 AI Credits/month',
                'Advanced Analytics',
                'Priority Support',
                '15 Active Campaigns',
                'A/B Testing'
            ]
        },
        ENTERPRISE: {
            id: 'enterprise',
            name: 'Enterprise Plan',
            price: 199.99,
            credits: 1000,
            features: [
                'Unlimited AI Credits',
                'Premium Analytics',
                '24/7 Support',
                'Unlimited Campaigns',
                'Custom Integration'
            ]
        }
    };

    // Stripe Payment Processing
    async createStripeSubscription(userId, planId) {
        try {
            const user = await User.findById(userId);
            const plan = PaymentService.PLANS[planId.toUpperCase()];

            if (!plan) {
                throw new Error('Invalid plan selected');
            }

            // Create or get Stripe customer
            let stripeCustomerId = user.stripeCustomerId;
            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    metadata: { userId: user._id.toString() }
                });
                stripeCustomerId = customer.id;
                user.stripeCustomerId = stripeCustomerId;
                await user.save();
            }

            // Create subscription
            const subscription = await stripe.subscriptions.create({
                customer: stripeCustomerId,
                items: [{ price: plan.stripePriceId }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent']
            });

            // Save subscription details
            await Subscription.create({
                userId: user._id,
                planId: planId,
                stripeSubscriptionId: subscription.id,
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000)
            });

            return {
                subscriptionId: subscription.id,
                clientSecret: subscription.latest_invoice.payment_intent.client_secret
            };
        } catch (error) {
            console.error('Error creating Stripe subscription:', error);
            throw error;
        }
    }

    // PayPal Payment Processing
    async createPayPalSubscription(userId, planId) {
        try {
            const user = await User.findById(userId);
            const plan = PaymentService.PLANS[planId.toUpperCase()];

            if (!plan) {
                throw new Error('Invalid plan selected');
            }

            const request = new paypal.orders.OrdersCreateRequest();
            request.prefer("return=representation");
            request.requestBody({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'USD',
                        value: plan.price.toString()
                    },
                    description: `${plan.name} Subscription`,
                    payee: {
                        email_address: PAYPAL_MERCHANT_EMAIL,
                        merchant_id: PAYPAL_MERCHANT_ID
                    }
                }]
            });

            const order = await paypalClient.execute(request);

            // Save transaction details
            await Transaction.create({
                userId: user._id,
                planId: planId,
                paypalOrderId: order.result.id,
                amount: plan.price,
                status: 'pending'
            });

            return {
                orderId: order.result.id,
                approvalUrl: order.result.links.find(link => link.rel === 'approve').href
            };
        } catch (error) {
            console.error('Error creating PayPal subscription:', error);
            throw error;
        }
    }

    // Credit Card Processing
    async processCardPayment(userId, paymentMethod, amount) {
        try {
            const user = await User.findById(userId);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'usd',
                customer: user.stripeCustomerId,
                payment_method: paymentMethod,
                confirm: true,
                description: 'AI Advertisement Credit Purchase'
            });

            // Save transaction
            await Transaction.create({
                userId: user._id,
                amount: amount,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status
            });

            return paymentIntent;
        } catch (error) {
            console.error('Error processing card payment:', error);
            throw error;
        }
    }

    // Subscription Management
    async cancelSubscription(userId) {
        try {
            const subscription = await Subscription.findOne({ userId, status: 'active' });
            if (!subscription) {
                throw new Error('No active subscription found');
            }

            if (subscription.stripeSubscriptionId) {
                await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
            }

            subscription.status = 'cancelled';
            subscription.cancelledAt = new Date();
            await subscription.save();

            return { success: true, message: 'Subscription cancelled successfully' };
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            throw error;
        }
    }

    async upgradePlan(userId, newPlanId) {
        try {
            const user = await User.findById(userId);
            const currentSubscription = await Subscription.findOne({ userId, status: 'active' });

            if (!currentSubscription) {
                throw new Error('No active subscription found');
            }

            if (currentSubscription.stripeSubscriptionId) {
                await stripe.subscriptions.update(currentSubscription.stripeSubscriptionId, {
                    items: [{
                        id: currentSubscription.stripeSubscriptionId,
                        price: PaymentService.PLANS[newPlanId.toUpperCase()].stripePriceId
                    }],
                    proration_behavior: 'always_invoice'
                });
            }

            currentSubscription.planId = newPlanId;
            await currentSubscription.save();

            return { success: true, message: 'Plan upgraded successfully' };
        } catch (error) {
            console.error('Error upgrading plan:', error);
            throw error;
        }
    }

    // Credit Management
    async purchaseCredits(userId, creditAmount, paymentMethod) {
        try {
            const creditPrice = this.calculateCreditPrice(creditAmount);
            
            // Process payment
            const payment = await this.processCardPayment(userId, paymentMethod, creditPrice);

            if (payment.status === 'succeeded') {
                // Update user credits
                await User.findByIdAndUpdate(userId, {
                    $inc: { credits: creditAmount }
                });

                return {
                    success: true,
                    credits: creditAmount,
                    amount: creditPrice,
                    transactionId: payment.id
                };
            }

            throw new Error('Payment processing failed');
        } catch (error) {
            console.error('Error purchasing credits:', error);
            throw error;
        }
    }

    calculateCreditPrice(creditAmount) {
        // Implement tiered pricing for credits
        if (creditAmount >= 1000) return creditAmount * 0.05; // $0.05 per credit
        if (creditAmount >= 500) return creditAmount * 0.07; // $0.07 per credit
        return creditAmount * 0.10; // $0.10 per credit
    }

    // Affiliate Program
    async processAffiliateCommission(affiliateId, saleAmount) {
        try {
            const affiliate = await User.findById(affiliateId);
            const commissionRate = this.calculateCommissionRate(affiliate);
            const commissionAmount = saleAmount * commissionRate;

            // Create commission transaction
            await Transaction.create({
                userId: affiliateId,
                type: 'commission',
                amount: commissionAmount,
                status: 'pending',
                metadata: {
                    saleAmount: saleAmount,
                    commissionRate: commissionRate
                }
            });

            return {
                success: true,
                commissionAmount,
                commissionRate
            };
        } catch (error) {
            console.error('Error processing affiliate commission:', error);
            throw error;
        }
    }

    calculateCommissionRate(affiliate) {
        // Implement tiered commission rates based on affiliate performance
        const totalSales = affiliate.affiliateStats?.totalSales || 0;
        if (totalSales >= 10000) return 0.15; // 15%
        if (totalSales >= 5000) return 0.12; // 12%
        if (totalSales >= 1000) return 0.10; // 10%
        return 0.08; // 8% base rate
    }

    // Refund Processing
    async processRefund(transactionId, amount, reason) {
        try {
            const transaction = await Transaction.findById(transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }

            if (transaction.paymentIntentId) {
                // Process Stripe refund
                const refund = await stripe.refunds.create({
                    payment_intent: transaction.paymentIntentId,
                    amount: Math.round(amount * 100)
                });

                await Transaction.create({
                    userId: transaction.userId,
                    type: 'refund',
                    amount: amount,
                    status: refund.status,
                    metadata: {
                        originalTransactionId: transactionId,
                        reason: reason,
                        refundId: refund.id
                    }
                });

                return { success: true, refundId: refund.id };
            }

            throw new Error('Unsupported payment method for refund');
        } catch (error) {
            console.error('Error processing refund:', error);
            throw error;
        }
    }
}

module.exports = new PaymentService();

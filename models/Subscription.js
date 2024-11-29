const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    planId: {
        type: String,
        required: true,
        enum: ['starter', 'professional', 'enterprise']
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'cancelled', 'expired', 'past_due'],
        default: 'active'
    },
    stripeSubscriptionId: String,
    paypalSubscriptionId: String,
    currentPeriodStart: {
        type: Date,
        default: Date.now
    },
    currentPeriodEnd: {
        type: Date,
        required: true
    },
    cancelledAt: Date,
    cancelReason: String,
    features: [{
        name: String,
        enabled: Boolean
    }],
    usage: {
        creditsUsed: {
            type: Number,
            default: 0
        },
        campaignsCreated: {
            type: Number,
            default: 0
        },
        lastUsageDate: Date
    },
    billingDetails: {
        amount: Number,
        currency: {
            type: String,
            default: 'USD'
        },
        interval: {
            type: String,
            enum: ['month', 'year'],
            default: 'month'
        },
        lastBillingDate: Date,
        nextBillingDate: Date
    },
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true
});

// Index for quick lookups
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });
subscriptionSchema.index({ paypalSubscriptionId: 1 });

// Pre-save hook to update next billing date
subscriptionSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('currentPeriodStart')) {
        const interval = this.billingDetails.interval;
        const currentPeriodStart = this.currentPeriodStart;
        
        // Calculate next billing date based on interval
        this.billingDetails.nextBillingDate = new Date(currentPeriodStart);
        if (interval === 'month') {
            this.billingDetails.nextBillingDate.setMonth(
                this.billingDetails.nextBillingDate.getMonth() + 1
            );
        } else {
            this.billingDetails.nextBillingDate.setFullYear(
                this.billingDetails.nextBillingDate.getFullYear() + 1
            );
        }
    }
    next();
});

// Instance methods
subscriptionSchema.methods.isActive = function() {
    return this.status === 'active' && this.currentPeriodEnd > new Date();
};

subscriptionSchema.methods.canUpgrade = function() {
    return this.status === 'active' && !this.cancelledAt;
};

subscriptionSchema.methods.getRemainingDays = function() {
    const now = new Date();
    const end = this.currentPeriodEnd;
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.updateUsage = function(creditsUsed = 0, campaignsCreated = 0) {
    this.usage.creditsUsed += creditsUsed;
    this.usage.campaignsCreated += campaignsCreated;
    this.usage.lastUsageDate = new Date();
    return this.save();
};

// Static methods
subscriptionSchema.statics.findActiveSubscription = function(userId) {
    return this.findOne({
        userId: userId,
        status: 'active',
        currentPeriodEnd: { $gt: new Date() }
    });
};

subscriptionSchema.statics.getSubscriptionStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$planId',
                totalSpent: { $sum: '$billingDetails.amount' },
                averageUsage: { $avg: '$usage.creditsUsed' },
                totalCampaigns: { $sum: '$usage.campaignsCreated' }
            }
        }
    ]);
    return stats;
};

module.exports = mongoose.model('Subscription', subscriptionSchema);

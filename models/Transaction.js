const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['subscription', 'credit_purchase', 'refund', 'commission', 'affiliate_payout']
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed', 'refunded', 'disputed'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['stripe', 'paypal', 'credit_card', 'bank_transfer'],
        required: true
    },
    paymentIntentId: String,
    paypalOrderId: String,
    stripeChargeId: String,
    description: String,
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    billingDetails: {
        name: String,
        email: String,
        address: {
            line1: String,
            line2: String,
            city: String,
            state: String,
            postal_code: String,
            country: String
        }
    },
    refundDetails: {
        refundId: String,
        amount: Number,
        reason: String,
        status: String,
        refundedAt: Date
    },
    disputeDetails: {
        disputeId: String,
        reason: String,
        status: String,
        resolvedAt: Date
    },
    subscriptionDetails: {
        planId: String,
        period: {
            start: Date,
            end: Date
        }
    },
    affiliateDetails: {
        affiliateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        commissionRate: Number,
        commissionAmount: Number
    }
}, {
    timestamps: true
});

// Indexes for quick lookups
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ paymentIntentId: 1 });
transactionSchema.index({ paypalOrderId: 1 });
transactionSchema.index({ type: 1, status: 1 });

// Pre-save middleware
transactionSchema.pre('save', function(next) {
    // Generate a unique transaction reference
    if (!this.metadata?.get('transactionRef')) {
        const prefix = this.type.charAt(0).toUpperCase();
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        this.metadata = this.metadata || new Map();
        this.metadata.set('transactionRef', `${prefix}${timestamp}${random}`.toUpperCase());
    }
    next();
});

// Instance methods
transactionSchema.methods.markAsCompleted = async function() {
    this.status = 'completed';
    return this.save();
};

transactionSchema.methods.processRefund = async function(amount, reason) {
    if (this.status === 'refunded') {
        throw new Error('Transaction already refunded');
    }

    this.status = 'refunded';
    this.refundDetails = {
        amount: amount || this.amount,
        reason: reason,
        status: 'completed',
        refundedAt: new Date()
    };

    return this.save();
};

transactionSchema.methods.updateDispute = async function(disputeDetails) {
    this.disputeDetails = {
        ...this.disputeDetails,
        ...disputeDetails,
        updatedAt: new Date()
    };
    return this.save();
};

// Static methods
transactionSchema.statics.getRevenueStats = async function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    type: '$type'
                },
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: {
                '_id.year': 1,
                '_id.month': 1
            }
        }
    ]);
};

transactionSchema.statics.getUserTransactionHistory = async function(userId) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .select('-metadata -billingDetails.address')
        .lean();
};

transactionSchema.statics.getAffiliateEarnings = async function(affiliateId, period) {
    const startDate = period === 'month' 
        ? new Date(new Date().setDate(1))
        : new Date(new Date().setMonth(0, 1));

    return this.aggregate([
        {
            $match: {
                'affiliateDetails.affiliateId': mongoose.Types.ObjectId(affiliateId),
                type: 'commission',
                status: 'completed',
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: null,
                totalEarnings: { $sum: '$affiliateDetails.commissionAmount' },
                totalTransactions: { $sum: 1 },
                averageCommission: { $avg: '$affiliateDetails.commissionAmount' }
            }
        }
    ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);

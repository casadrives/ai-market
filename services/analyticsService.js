const Ad = require('../models/Ad');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Subscription = require('../models/Subscription');

class AnalyticsService {
    // Campaign Performance Analytics
    async getAdPerformanceMetrics(adId, dateRange) {
        try {
            const ad = await Ad.findById(adId);
            if (!ad) {
                throw new Error('Ad not found');
            }

            const metrics = await Ad.aggregate([
                {
                    $match: {
                        _id: ad._id,
                        createdAt: {
                            $gte: dateRange.start,
                            $lte: dateRange.end
                        }
                    }
                },
                {
                    $project: {
                        impressions: '$performance.impressions',
                        clicks: '$performance.clicks',
                        conversions: '$performance.conversions',
                        ctr: {
                            $multiply: [
                                { $divide: ['$performance.clicks', '$performance.impressions'] },
                                100
                            ]
                        },
                        conversionRate: {
                            $multiply: [
                                { $divide: ['$performance.conversions', '$performance.clicks'] },
                                100
                            ]
                        },
                        costPerClick: {
                            $divide: ['$budget.spent', '$performance.clicks']
                        },
                        costPerConversion: {
                            $divide: ['$budget.spent', '$performance.conversions']
                        }
                    }
                }
            ]);

            return metrics[0];
        } catch (error) {
            console.error('Error getting ad performance metrics:', error);
            throw error;
        }
    }

    // User Analytics
    async getUserAnalytics(userId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            const [adMetrics, transactions, subscription] = await Promise.all([
                // Ad performance
                Ad.aggregate([
                    {
                        $match: {
                            user: userId,
                            createdAt: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalImpressions: { $sum: '$performance.impressions' },
                            totalClicks: { $sum: '$performance.clicks' },
                            totalConversions: { $sum: '$performance.conversions' },
                            totalSpent: { $sum: '$budget.spent' },
                            averageCTR: {
                                $avg: {
                                    $multiply: [
                                        { $divide: ['$performance.clicks', '$performance.impressions'] },
                                        100
                                    ]
                                }
                            }
                        }
                    }
                ]),
                // Transaction history
                Transaction.find({
                    userId,
                    createdAt: { $gte: startDate }
                }).sort({ createdAt: -1 }),
                // Subscription status
                Subscription.findOne({ userId, status: 'active' })
            ]);

            return {
                adMetrics: adMetrics[0] || {
                    totalImpressions: 0,
                    totalClicks: 0,
                    totalConversions: 0,
                    totalSpent: 0,
                    averageCTR: 0
                },
                transactions,
                subscription
            };
        } catch (error) {
            console.error('Error getting user analytics:', error);
            throw error;
        }
    }

    // Revenue Analytics
    async getRevenueAnalytics(period = 'month') {
        try {
            const startDate = new Date();
            if (period === 'month') {
                startDate.setMonth(startDate.getMonth() - 1);
            } else if (period === 'year') {
                startDate.setFullYear(startDate.getFullYear() - 1);
            }

            const revenue = await Transaction.aggregate([
                {
                    $match: {
                        status: 'completed',
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                        },
                        totalRevenue: { $sum: '$amount' },
                        subscriptionRevenue: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'subscription'] }, '$amount', 0]
                            }
                        },
                        creditRevenue: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'credit_purchase'] }, '$amount', 0]
                            }
                        },
                        transactionCount: { $sum: 1 }
                    }
                },
                {
                    $sort: {
                        '_id.year': 1,
                        '_id.month': 1,
                        '_id.day': 1
                    }
                }
            ]);

            return revenue;
        } catch (error) {
            console.error('Error getting revenue analytics:', error);
            throw error;
        }
    }

    // Campaign ROI Analysis
    async getCampaignROI(adId) {
        try {
            const ad = await Ad.findById(adId);
            if (!ad) {
                throw new Error('Ad not found');
            }

            const roi = {
                spent: ad.budget.spent,
                impressions: ad.performance.impressions,
                clicks: ad.performance.clicks,
                conversions: ad.performance.conversions,
                cpc: ad.budget.spent / ad.performance.clicks,
                cpa: ad.budget.spent / ad.performance.conversions,
                roi: ((ad.performance.conversions * ad.targeting.conversionValue) - ad.budget.spent) / ad.budget.spent * 100
            };

            return roi;
        } catch (error) {
            console.error('Error calculating campaign ROI:', error);
            throw error;
        }
    }

    // Audience Insights
    async getAudienceInsights(userId) {
        try {
            const insights = await Ad.aggregate([
                {
                    $match: { user: userId }
                },
                {
                    $group: {
                        _id: '$targeting.audience.demographics',
                        impressions: { $sum: '$performance.impressions' },
                        clicks: { $sum: '$performance.clicks' },
                        conversions: { $sum: '$performance.conversions' },
                        engagementRate: {
                            $avg: {
                                $multiply: [
                                    { $divide: ['$performance.clicks', '$performance.impressions'] },
                                    100
                                ]
                            }
                        }
                    }
                },
                {
                    $sort: { engagementRate: -1 }
                }
            ]);

            return insights;
        } catch (error) {
            console.error('Error getting audience insights:', error);
            throw error;
        }
    }

    // Trend Analysis
    async getPerformanceTrends(userId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            const trends = await Ad.aggregate([
                {
                    $match: {
                        user: userId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                        },
                        impressions: { $sum: '$performance.impressions' },
                        clicks: { $sum: '$performance.clicks' },
                        conversions: { $sum: '$performance.conversions' },
                        spent: { $sum: '$budget.spent' }
                    }
                },
                {
                    $sort: {
                        '_id.year': 1,
                        '_id.month': 1,
                        '_id.day': 1
                    }
                }
            ]);

            return trends;
        } catch (error) {
            console.error('Error getting performance trends:', error);
            throw error;
        }
    }

    // Competitive Analysis
    async getCompetitiveInsights(adId) {
        try {
            const ad = await Ad.findById(adId);
            if (!ad) {
                throw new Error('Ad not found');
            }

            const industryBenchmarks = await this.getIndustryBenchmarks(ad.targeting.industry);
            const performance = {
                ctr: (ad.performance.clicks / ad.performance.impressions) * 100,
                conversionRate: (ad.performance.conversions / ad.performance.clicks) * 100,
                cpc: ad.budget.spent / ad.performance.clicks
            };

            return {
                performance,
                benchmarks: industryBenchmarks,
                comparison: {
                    ctr: (performance.ctr / industryBenchmarks.ctr) * 100,
                    conversionRate: (performance.conversionRate / industryBenchmarks.conversionRate) * 100,
                    cpc: (industryBenchmarks.cpc / performance.cpc) * 100
                }
            };
        } catch (error) {
            console.error('Error getting competitive insights:', error);
            throw error;
        }
    }

    // Helper method to get industry benchmarks
    async getIndustryBenchmarks(industry) {
        // This would typically come from a database or external API
        // For now, returning mock data
        const benchmarks = {
            technology: { ctr: 2.5, conversionRate: 3.2, cpc: 1.5 },
            retail: { ctr: 1.8, conversionRate: 2.5, cpc: 0.8 },
            finance: { ctr: 3.1, conversionRate: 4.5, cpc: 2.1 },
            default: { ctr: 2.0, conversionRate: 3.0, cpc: 1.2 }
        };

        return benchmarks[industry] || benchmarks.default;
    }
}

module.exports = new AnalyticsService();

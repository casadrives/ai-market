const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    type: {
        type: String,
        enum: ['social', 'display', 'search', 'video'],
        required: true
    },
    content: {
        text: String,
        images: [String],
        video: String
    },
    targeting: {
        audience: {
            age: {
                min: Number,
                max: Number
            },
            gender: String,
            locations: [String],
            interests: [String]
        },
        platforms: [String]
    },
    performance: {
        impressions: {
            type: Number,
            default: 0
        },
        clicks: {
            type: Number,
            default: 0
        },
        conversions: {
            type: Number,
            default: 0
        },
        ctr: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'active', 'paused', 'completed'],
        default: 'draft'
    },
    budget: {
        daily: Number,
        total: Number,
        spent: {
            type: Number,
            default: 0
        }
    },
    schedule: {
        startDate: Date,
        endDate: Date,
        timezone: String
    },
    aiGenerated: {
        type: Boolean,
        default: true
    },
    aiPrompt: String,
    version: {
        type: Number,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
adSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Ad', adSchema);

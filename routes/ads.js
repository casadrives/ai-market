const express = require('express');
const router = express.Router();
const { Configuration, OpenAIApi } = require('openai');
const Ad = require('../models/Ad');
const auth = require('../middleware/auth');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Create new ad
router.post('/', auth, async (req, res) => {
    try {
        const { type, description, targeting, budget } = req.body;

        // Generate AI content if requested
        if (req.body.useAI) {
            const prompt = `Create a compelling ${type} advertisement about: ${description}. 
                          Target audience: ${targeting.audience.toString()}. 
                          Keep it under 280 characters.`;

            const completion = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: prompt,
                max_tokens: 100
            });

            req.body.content = {
                text: completion.data.choices[0].text.trim(),
                images: [],
                video: null
            };
            req.body.aiPrompt = prompt;
        }

        const ad = new Ad({
            ...req.body,
            user: req.user.id
        });

        await ad.save();
        res.status(201).json(ad);
    } catch (error) {
        res.status(500).json({ message: 'Error creating ad', error: error.message });
    }
});

// Get all ads for user
router.get('/', auth, async (req, res) => {
    try {
        const ads = await Ad.find({ user: req.user.id })
            .sort({ createdAt: -1 });
        res.json(ads);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ads', error: error.message });
    }
});

// Get single ad
router.get('/:id', auth, async (req, res) => {
    try {
        const ad = await Ad.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }

        res.json(ad);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ad', error: error.message });
    }
});

// Update ad
router.put('/:id', auth, async (req, res) => {
    try {
        const ad = await Ad.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { $set: req.body },
            { new: true }
        );

        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }

        res.json(ad);
    } catch (error) {
        res.status(500).json({ message: 'Error updating ad', error: error.message });
    }
});

// Delete ad
router.delete('/:id', auth, async (req, res) => {
    try {
        const ad = await Ad.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }

        res.json({ message: 'Ad deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting ad', error: error.message });
    }
});

// Generate variations of an ad
router.post('/:id/variations', auth, async (req, res) => {
    try {
        const ad = await Ad.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }

        const prompt = `Create 3 variations of this advertisement: ${ad.content.text}. 
                       Keep the same tone and target audience, but vary the wording and approach.`;

        const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: prompt,
            max_tokens: 300,
            n: 3
        });

        const variations = completion.data.choices.map(choice => ({
            text: choice.text.trim(),
            original: ad.content.text
        }));

        res.json(variations);
    } catch (error) {
        res.status(500).json({ message: 'Error generating variations', error: error.message });
    }
});

module.exports = router;

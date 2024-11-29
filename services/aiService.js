const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

class AIService {
    async generateAdContent(prompt, type, tone, targetAudience) {
        const systemPrompt = `You are an expert advertising copywriter. Create compelling ad content that is:
            - Type: ${type}
            - Tone: ${tone}
            - Target Audience: ${targetAudience}
            - Must be engaging and conversion-focused`;

        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 250
            });

            return completion.data.choices[0].message.content;
        } catch (error) {
            console.error('Error generating ad content:', error);
            throw error;
        }
    }

    async generateAdImage(prompt, style, dimensions) {
        try {
            const response = await openai.createImage({
                prompt: `Create an advertisement image: ${prompt}. Style: ${style}`,
                n: 1,
                size: dimensions,
            });

            return response.data.data[0].url;
        } catch (error) {
            console.error('Error generating ad image:', error);
            throw error;
        }
    }

    async analyzeAdPerformance(adData) {
        const analysisPrompt = `Analyze this ad performance data and provide optimization suggestions:
            - Impressions: ${adData.impressions}
            - Clicks: ${adData.clicks}
            - Conversions: ${adData.conversions}
            - Target Audience: ${adData.targetAudience}
            - Ad Content: ${adData.content}`;

        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are an expert in advertising analytics and optimization." },
                    { role: "user", content: analysisPrompt }
                ],
                temperature: 0.5
            });

            return {
                analysis: completion.data.choices[0].message.content,
                suggestions: this.parseOptimizationSuggestions(completion.data.choices[0].message.content)
            };
        } catch (error) {
            console.error('Error analyzing ad performance:', error);
            throw error;
        }
    }

    async generateABTestVariations(originalAd) {
        const prompt = `Create 3 A/B test variations for this advertisement:
            Original: ${originalAd.content}
            Target Audience: ${originalAd.targetAudience}
            Current Performance: CTR ${originalAd.ctr}%
            
            Provide variations that test different:
            1. Headlines
            2. Call-to-actions
            3. Value propositions`;

        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are an A/B testing expert for advertisements." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.8
            });

            return this.parseABTestVariations(completion.data.choices[0].message.content);
        } catch (error) {
            console.error('Error generating A/B test variations:', error);
            throw error;
        }
    }

    async predictAdPerformance(adContent, targetAudience, platform) {
        const prompt = `Predict the performance metrics for this advertisement:
            Content: ${adContent}
            Target Audience: ${targetAudience}
            Platform: ${platform}
            
            Provide predictions for:
            1. Expected CTR range
            2. Estimated conversion rate
            3. Audience engagement level
            4. Potential challenges
            5. Success factors`;

        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are an AI specialized in predicting advertising performance metrics." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.4
            });

            return this.parsePerformancePrediction(completion.data.choices[0].message.content);
        } catch (error) {
            console.error('Error predicting ad performance:', error);
            throw error;
        }
    }

    async generateTargetingRecommendations(adData, marketingGoals) {
        const prompt = `Based on this ad data and marketing goals, provide targeting recommendations:
            Ad Data: ${JSON.stringify(adData)}
            Marketing Goals: ${marketingGoals}
            
            Include recommendations for:
            1. Demographic targeting
            2. Interest-based targeting
            3. Behavioral targeting
            4. Platform selection
            5. Timing optimization`;

        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are an expert in digital advertising targeting and optimization." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.6
            });

            return this.parseTargetingRecommendations(completion.data.choices[0].message.content);
        } catch (error) {
            console.error('Error generating targeting recommendations:', error);
            throw error;
        }
    }

    // Helper methods for parsing AI responses
    parseOptimizationSuggestions(content) {
        // Parse and structure optimization suggestions
        const suggestions = content.split('\n').filter(line => line.trim().length > 0);
        return suggestions.map(suggestion => ({
            suggestion: suggestion,
            priority: this.calculatePriority(suggestion)
        }));
    }

    parseABTestVariations(content) {
        // Parse A/B test variations into structured format
        const variations = content.split('\n\n').filter(v => v.trim().length > 0);
        return variations.map(variation => ({
            content: variation,
            type: this.identifyVariationType(variation)
        }));
    }

    parsePerformancePrediction(content) {
        // Parse and structure performance predictions
        return {
            ctr: this.extractMetric(content, 'CTR'),
            conversionRate: this.extractMetric(content, 'conversion'),
            engagement: this.extractMetric(content, 'engagement'),
            challenges: this.extractChallenges(content),
            successFactors: this.extractSuccessFactors(content)
        };
    }

    parseTargetingRecommendations(content) {
        // Parse and structure targeting recommendations
        return {
            demographic: this.extractTargetingSection(content, 'demographic'),
            interests: this.extractTargetingSection(content, 'interest'),
            behavioral: this.extractTargetingSection(content, 'behavioral'),
            platforms: this.extractTargetingSection(content, 'platform'),
            timing: this.extractTargetingSection(content, 'timing')
        };
    }

    calculatePriority(suggestion) {
        // Implement priority calculation logic
        const urgencyKeywords = ['immediately', 'urgent', 'critical', 'important'];
        return urgencyKeywords.some(keyword => suggestion.toLowerCase().includes(keyword)) ? 'high' : 'medium';
    }

    identifyVariationType(variation) {
        // Identify the type of A/B test variation
        if (variation.toLowerCase().includes('headline')) return 'headline';
        if (variation.toLowerCase().includes('cta')) return 'call-to-action';
        return 'value-proposition';
    }

    extractMetric(content, metricType) {
        // Extract specific metrics from the content
        const regex = new RegExp(`${metricType}[^0-9]*([0-9]+(?:\\.[0-9]+)?)`);
        const match = content.match(regex);
        return match ? parseFloat(match[1]) : null;
    }

    extractChallenges(content) {
        // Extract challenges from the content
        const challengesSection = content.split('Challenges:')[1]?.split('\n') || [];
        return challengesSection
            .filter(line => line.trim().length > 0)
            .map(challenge => challenge.trim());
    }

    extractSuccessFactors(content) {
        // Extract success factors from the content
        const factorsSection = content.split('Success factors:')[1]?.split('\n') || [];
        return factorsSection
            .filter(line => line.trim().length > 0)
            .map(factor => factor.trim());
    }

    extractTargetingSection(content, sectionType) {
        // Extract specific targeting sections
        const section = content.split(`${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)} targeting:`)[1]?.split('\n') || [];
        return section
            .filter(line => line.trim().length > 0)
            .map(item => item.trim());
    }
}

module.exports = new AIService();

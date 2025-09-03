const express = require('express');
const router = express.Router();
const axios = require('axios');

// Note: Using Google Translate as requested, but this does send data externally
// For fully local translation, consider alternatives like:
// - Helsinki-NLP models via Hugging Face Transformers
// - LibreTranslate (self-hosted)
// - Argos Translate

// Languages supported for debt advice translations
const SUPPORTED_LANGUAGES = {
    'es': 'Spanish',
    'fr': 'French', 
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'pl': 'Polish',
    'ar': 'Arabic',
    'ur': 'Urdu',
    'hi': 'Hindi',
    'zh': 'Chinese (Simplified)',
    'tr': 'Turkish',
    'ro': 'Romanian',
    'bg': 'Bulgarian'
};

// Translate text using Google Translate API
router.post('/translate', async (req, res) => {
    try {
        const { text, target_language, source_language = 'en' } = req.body;

        if (!text || !target_language) {
            return res.status(400).json({ message: 'Text and target language are required' });
        }

        if (!SUPPORTED_LANGUAGES[target_language]) {
            return res.status(400).json({ message: 'Unsupported target language' });
        }

        // Check if Google Translate API key is available
        const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
        if (!apiKey) {
            // Fallback to local translation service if implemented
            const localTranslation = await attemptLocalTranslation(text, target_language);
            if (localTranslation) {
                return res.json({
                    translated_text: localTranslation,
                    source_language,
                    target_language,
                    provider: 'local',
                    timestamp: new Date().toISOString()
                });
            }
            
            return res.status(503).json({ 
                message: 'Translation service not configured. Please set GOOGLE_TRANSLATE_API_KEY or enable local translation service.',
                fallback_message: 'Consider using a local translation service for data privacy.'
            });
        }

        // Use Google Translate API
        const response = await axios.post(
            `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
            {
                q: text,
                source: source_language,
                target: target_language,
                format: 'text'
            }
        );

        const translatedText = response.data.data.translations[0].translatedText;

        // Log translation for audit (without sensitive content)
        console.log(`Translation: ${source_language} -> ${target_language}, Length: ${text.length} chars`);

        res.json({
            translated_text: translatedText,
            source_language,
            target_language,
            provider: 'google_translate',
            confidence: response.data.data.translations[0].detectedSourceLanguage ? 0.9 : 1.0,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Translation error:', error);
        
        // Try local fallback
        try {
            const localTranslation = await attemptLocalTranslation(req.body.text, req.body.target_language);
            if (localTranslation) {
                return res.json({
                    translated_text: localTranslation,
                    source_language: req.body.source_language,
                    target_language: req.body.target_language,
                    provider: 'local_fallback',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (fallbackError) {
            console.error('Local translation fallback failed:', fallbackError);
        }

        res.status(500).json({ 
            message: 'Translation failed', 
            error: error.response?.data?.error?.message || error.message
        });
    }
});

// Get supported languages
router.get('/languages', (req, res) => {
    res.json({
        supported_languages: Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
            code,
            name
        })),
        total_count: Object.keys(SUPPORTED_LANGUAGES).length
    });
});

// Detect language of text
router.post('/detect', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }

        const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ message: 'Translation service not configured' });
        }

        const response = await axios.post(
            `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`,
            { q: text }
        );

        const detection = response.data.data.detections[0][0];

        res.json({
            detected_language: detection.language,
            confidence: detection.confidence,
            is_reliable: detection.isReliable || detection.confidence > 0.7,
            language_name: getLanguageName(detection.language)
        });

    } catch (error) {
        console.error('Language detection error:', error);
        res.status(500).json({ message: 'Language detection failed' });
    }
});

// Batch translate multiple texts
router.post('/translate-batch', async (req, res) => {
    try {
        const { texts, target_language, source_language = 'en' } = req.body;

        if (!texts || !Array.isArray(texts) || !target_language) {
            return res.status(400).json({ message: 'Texts array and target language are required' });
        }

        if (texts.length > 100) {
            return res.status(400).json({ message: 'Maximum 100 texts per batch request' });
        }

        const translations = [];
        
        // Process in smaller chunks to avoid API limits
        const chunkSize = 10;
        for (let i = 0; i < texts.length; i += chunkSize) {
            const chunk = texts.slice(i, i + chunkSize);
            
            try {
                const response = await axios.post('/api/translation/translate', {
                    text: chunk.join('\n---SEPARATOR---\n'),
                    target_language,
                    source_language
                });

                const translatedChunk = response.data.translated_text.split('\n---SEPARATOR---\n');
                translations.push(...translatedChunk);
                
            } catch (error) {
                console.error(`Batch translation chunk ${i} failed:`, error);
                // Add error placeholders for failed translations
                translations.push(...chunk.map(() => 'Translation failed'));
            }
        }

        res.json({
            translations,
            source_language,
            target_language,
            total_count: texts.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Batch translation error:', error);
        res.status(500).json({ message: 'Batch translation failed' });
    }
});

// Attempt local translation using dedicated translation service
async function attemptLocalTranslation(text, targetLanguage) {
    try {
        // First try dedicated local translation service
        const translationServiceUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:8003';
        const response = await axios.post(`${translationServiceUrl}/translate`, {
            text: text,
            target_language: targetLanguage,
            source_language: 'en'
        });

        return response.data.translated_text;
        
    } catch (translationServiceError) {
        console.warn('Dedicated translation service failed, trying chatbot fallback:', translationServiceError.message);
        
        try {
            // Fallback to chatbot service for translation
            const response = await axios.post(
                `${process.env.CHATBOT_URL || 'http://localhost:8001'}/chat`,
                {
                    message: `Translate the following text to ${SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage}. Only return the translation, no explanations:\n\n${text}`,
                    case_id: null,
                    user_id: null
                }
            );

            return response.data.response;
            
        } catch (chatbotError) {
            console.error('All local translation methods failed:', chatbotError);
            return null;
        }
    }
}

function getLanguageName(languageCode) {
    return SUPPORTED_LANGUAGES[languageCode] || languageCode;
}

module.exports = router;
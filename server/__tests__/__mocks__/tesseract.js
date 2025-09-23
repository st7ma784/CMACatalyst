// Mock for tesseract.js
module.exports = {
    recognize: jest.fn().mockResolvedValue({
        data: {
            text: 'Mock OCR result',
            confidence: 95,
            words: [
                { text: 'Mock', confidence: 95 },
                { text: 'OCR', confidence: 95 },
                { text: 'result', confidence: 95 }
            ]
        }
    }),
    createWorker: jest.fn().mockReturnValue({
        loadLanguage: jest.fn().mockResolvedValue(),
        initialize: jest.fn().mockResolvedValue(),
        setParameters: jest.fn().mockResolvedValue(),
        recognize: jest.fn().mockResolvedValue({
            data: {
                text: 'Mock OCR result',
                confidence: 95
            }
        }),
        terminate: jest.fn().mockResolvedValue()
    })
};
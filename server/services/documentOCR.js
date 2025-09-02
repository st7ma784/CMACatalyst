const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

/**
 * Document OCR and Processing Service
 * Handles document scanning, text extraction, and intelligent data parsing
 */
class DocumentOCRService {
    constructor() {
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'pdf', 'tiff'];
        this.documentParsers = this.initializeParsers();
    }

    /**
     * Process uploaded document with OCR and intelligent parsing
     */
    async processDocument(fileId, filePath, documentType = 'auto') {
        try {
            // Create processing job record
            const jobId = await this.createProcessingJob(fileId);

            // Preprocess image for better OCR accuracy
            const preprocessedPath = await this.preprocessImage(filePath);

            // Extract text using OCR
            const ocrResult = await this.extractText(preprocessedPath);

            // Classify document type if not specified
            if (documentType === 'auto') {
                documentType = await this.classifyDocument(ocrResult.data.text);
            }

            // Parse document-specific data
            const parsedData = await this.parseDocumentData(ocrResult.data.text, documentType);

            // Update processing job with results
            await this.updateProcessingJob(jobId, {
                status: 'completed',
                ocr_confidence: ocrResult.data.confidence,
                extracted_text: ocrResult.data.text,
                document_type: documentType,
                parsed_data: parsedData,
                processing_time: Date.now()
            });

            // Clean up preprocessed file
            await fs.unlink(preprocessedPath).catch(() => {});

            return {
                success: true,
                jobId,
                documentType,
                confidence: ocrResult.data.confidence,
                extractedText: ocrResult.data.text,
                parsedData,
                suggestions: this.generateAutoPopulationSuggestions(parsedData, documentType)
            };

        } catch (error) {
            console.error('OCR processing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Preprocess image for better OCR accuracy
     */
    async preprocessImage(filePath) {
        const outputPath = filePath.replace(/\.[^/.]+$/, '_processed.png');

        await sharp(filePath)
            .greyscale()
            .normalize()
            .sharpen()
            .threshold(128)
            .png()
            .toFile(outputPath);

        return outputPath;
    }

    /**
     * Extract text using Tesseract OCR
     */
    async extractText(imagePath) {
        const result = await Tesseract.recognize(imagePath, 'eng', {
            logger: m => console.log('OCR Progress:', m)
        });

        return result;
    }

    /**
     * Classify document type based on content
     */
    async classifyDocument(text) {
        const classificationRules = {
            'bank_statement': [
                /statement period/i,
                /account balance/i,
                /sort code/i,
                /account number/i,
                /opening balance/i,
                /closing balance/i
            ],
            'benefit_letter': [
                /department for work and pensions/i,
                /dwp/i,
                /universal credit/i,
                /job seekers allowance/i,
                /employment support allowance/i,
                /personal independence payment/i
            ],
            'court_order': [
                /county court/i,
                /judgment/i,
                /claim number/i,
                /defendant/i,
                /claimant/i,
                /court fee/i
            ],
            'utility_bill': [
                /gas bill/i,
                /electricity bill/i,
                /water bill/i,
                /council tax/i,
                /meter reading/i,
                /tariff/i
            ],
            'employment_document': [
                /payslip/i,
                /salary/i,
                /national insurance/i,
                /tax code/i,
                /gross pay/i,
                /net pay/i
            ],
            'credit_report': [
                /credit score/i,
                /credit rating/i,
                /experian/i,
                /equifax/i,
                /callcredit/i,
                /credit history/i
            ]
        };

        for (const [docType, patterns] of Object.entries(classificationRules)) {
            const matches = patterns.filter(pattern => pattern.test(text)).length;
            if (matches >= 2) {
                return docType;
            }
        }

        return 'other';
    }

    /**
     * Initialize document-specific parsers
     */
    initializeParsers() {
        return {
            bank_statement: this.parseBankStatement.bind(this),
            benefit_letter: this.parseBenefitLetter.bind(this),
            court_order: this.parseCourtOrder.bind(this),
            utility_bill: this.parseUtilityBill.bind(this),
            employment_document: this.parseEmploymentDocument.bind(this),
            credit_report: this.parseCreditReport.bind(this)
        };
    }

    /**
     * Parse document data based on type
     */
    async parseDocumentData(text, documentType) {
        const parser = this.documentParsers[documentType];
        if (parser) {
            return await parser(text);
        }
        return { raw_text: text };
    }

    /**
     * Parse bank statement data
     */
    async parseBankStatement(text) {
        const data = {};

        // Extract account details
        const accountMatch = text.match(/account number[:\s]*(\d{8})/i);
        if (accountMatch) data.account_number = accountMatch[1];

        const sortCodeMatch = text.match(/sort code[:\s]*(\d{2}-\d{2}-\d{2})/i);
        if (sortCodeMatch) data.sort_code = sortCodeMatch[1];

        // Extract balances
        const openingBalanceMatch = text.match(/opening balance[:\s]*£?([\d,]+\.?\d*)/i);
        if (openingBalanceMatch) data.opening_balance = parseFloat(openingBalanceMatch[1].replace(/,/g, ''));

        const closingBalanceMatch = text.match(/closing balance[:\s]*£?([\d,]+\.?\d*)/i);
        if (closingBalanceMatch) data.closing_balance = parseFloat(closingBalanceMatch[1].replace(/,/g, ''));

        // Extract statement period
        const periodMatch = text.match(/statement period[:\s]*(\d{2}\/\d{2}\/\d{4})\s*to\s*(\d{2}\/\d{2}\/\d{4})/i);
        if (periodMatch) {
            data.period_start = periodMatch[1];
            data.period_end = periodMatch[2];
        }

        // Extract transactions (simplified)
        const transactionPattern = /(\d{2}\/\d{2})\s+([A-Z\s]+)\s+£?([\d,]+\.?\d*)/g;
        const transactions = [];
        let match;
        while ((match = transactionPattern.exec(text)) !== null) {
            transactions.push({
                date: match[1],
                description: match[2].trim(),
                amount: parseFloat(match[3].replace(/,/g, ''))
            });
        }
        data.transactions = transactions.slice(0, 10); // Limit to first 10 transactions

        return data;
    }

    /**
     * Parse benefit letter data
     */
    async parseBenefitLetter(text) {
        const data = {};

        // Extract benefit type
        const benefitTypes = [
            'universal credit', 'job seekers allowance', 'employment support allowance',
            'personal independence payment', 'disability living allowance', 'child benefit'
        ];
        
        for (const benefit of benefitTypes) {
            if (text.toLowerCase().includes(benefit)) {
                data.benefit_type = benefit;
                break;
            }
        }

        // Extract amounts
        const amountMatch = text.match(/£([\d,]+\.?\d*)/);
        if (amountMatch) data.benefit_amount = parseFloat(amountMatch[1].replace(/,/g, ''));

        // Extract reference number
        const refMatch = text.match(/reference[:\s]*([A-Z0-9]+)/i);
        if (refMatch) data.reference_number = refMatch[1];

        // Extract dates
        const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) data.letter_date = dateMatch[1];

        return data;
    }

    /**
     * Parse court order data
     */
    async parseCourtOrder(text) {
        const data = {};

        // Extract claim number
        const claimMatch = text.match(/claim number[:\s]*([A-Z0-9]+)/i);
        if (claimMatch) data.claim_number = claimMatch[1];

        // Extract judgment amount
        const amountMatch = text.match(/judgment[:\s]*£?([\d,]+\.?\d*)/i);
        if (amountMatch) data.judgment_amount = parseFloat(amountMatch[1].replace(/,/g, ''));

        // Extract court name
        const courtMatch = text.match(/([\w\s]+county court)/i);
        if (courtMatch) data.court_name = courtMatch[1];

        return data;
    }

    /**
     * Parse utility bill data
     */
    async parseUtilityBill(text) {
        const data = {};

        // Extract bill amount
        const amountMatch = text.match(/total[:\s]*£?([\d,]+\.?\d*)/i);
        if (amountMatch) data.bill_amount = parseFloat(amountMatch[1].replace(/,/g, ''));

        // Extract due date
        const dueDateMatch = text.match(/due date[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
        if (dueDateMatch) data.due_date = dueDateMatch[1];

        // Extract account number
        const accountMatch = text.match(/account[:\s]*([A-Z0-9]+)/i);
        if (accountMatch) data.account_number = accountMatch[1];

        return data;
    }

    /**
     * Parse employment document data
     */
    async parseEmploymentDocument(text) {
        const data = {};

        // Extract gross pay
        const grossMatch = text.match(/gross pay[:\s]*£?([\d,]+\.?\d*)/i);
        if (grossMatch) data.gross_pay = parseFloat(grossMatch[1].replace(/,/g, ''));

        // Extract net pay
        const netMatch = text.match(/net pay[:\s]*£?([\d,]+\.?\d*)/i);
        if (netMatch) data.net_pay = parseFloat(netMatch[1].replace(/,/g, ''));

        // Extract tax code
        const taxCodeMatch = text.match(/tax code[:\s]*([A-Z0-9]+)/i);
        if (taxCodeMatch) data.tax_code = taxCodeMatch[1];

        // Extract NI number
        const niMatch = text.match(/national insurance[:\s]*([A-Z]{2}\d{6}[A-Z])/i);
        if (niMatch) data.ni_number = niMatch[1];

        return data;
    }

    /**
     * Parse credit report data
     */
    async parseCreditReport(text) {
        const data = {};

        // Extract credit score
        const scoreMatch = text.match(/credit score[:\s]*(\d+)/i);
        if (scoreMatch) data.credit_score = parseInt(scoreMatch[1]);

        // Extract rating
        const ratingMatch = text.match(/rating[:\s]*(excellent|good|fair|poor)/i);
        if (ratingMatch) data.credit_rating = ratingMatch[1].toLowerCase();

        return data;
    }

    /**
     * Generate auto-population suggestions
     */
    generateAutoPopulationSuggestions(parsedData, documentType) {
        const suggestions = [];

        switch (documentType) {
            case 'bank_statement':
                if (parsedData.closing_balance) {
                    suggestions.push({
                        field: 'bank_balance',
                        value: parsedData.closing_balance,
                        confidence: 0.9
                    });
                }
                break;

            case 'benefit_letter':
                if (parsedData.benefit_amount) {
                    suggestions.push({
                        field: 'monthly_benefits',
                        value: parsedData.benefit_amount,
                        confidence: 0.85
                    });
                }
                break;

            case 'employment_document':
                if (parsedData.net_pay) {
                    suggestions.push({
                        field: 'monthly_income',
                        value: parsedData.net_pay,
                        confidence: 0.9
                    });
                }
                break;
        }

        return suggestions;
    }

    /**
     * Create processing job record
     */
    async createProcessingJob(fileId) {
        const query = `
            INSERT INTO document_processing_jobs (file_id, processing_status)
            VALUES ($1, 'processing')
            RETURNING id
        `;
        const result = await db.query(query, [fileId]);
        return result.rows[0].id;
    }

    /**
     * Update processing job with results
     */
    async updateProcessingJob(jobId, data) {
        const query = `
            UPDATE document_processing_jobs 
            SET processing_status = $2, ocr_confidence = $3, 
                extracted_data = $4, completed_at = NOW()
            WHERE id = $1
        `;
        await db.query(query, [
            jobId,
            data.status,
            data.ocr_confidence,
            JSON.stringify({
                extracted_text: data.extracted_text,
                document_type: data.document_type,
                parsed_data: data.parsed_data
            })
        ]);
    }
}

module.exports = new DocumentOCRService();

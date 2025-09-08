/**
 * MCP Plugin for Client Files Access
 * Provides structured access to client case files and documents
 * for AI workflows and n8n integrations
 */

const pool = require('../config/database');
const CaseFilestoreService = require('../services/caseFilestore');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ClientFilesMCP {
    constructor() {
        this.pluginName = 'client-files-mcp';
        this.version = '1.0.0';
        this.description = 'MCP plugin for accessing and managing client case files';
    }

    /**
     * Get file structure for a case
     */
    async getCaseFileStructure(caseId, userId) {
        try {
            // Verify user has access to this case
            const hasAccess = await this.verifyCaseAccess(caseId, userId);
            if (!hasAccess) {
                throw new Error('Access denied to case files');
            }

            const structure = await CaseFilestoreService.getCaseFolderStructure(caseId);
            
            // Add file counts and recent activity
            for (let folder of structure) {
                folder.recent_files = await this.getRecentFilesInFolder(folder.id, 5);
                folder.last_modified = await this.getFolderLastModified(folder.id);
            }

            return {
                case_id: caseId,
                folder_structure: structure,
                total_folders: structure.length,
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting case file structure:', error);
            throw error;
        }
    }

    /**
     * Search files across a case with advanced filters
     */
    async searchCaseFiles(caseId, searchParams, userId) {
        try {
            const hasAccess = await this.verifyCaseAccess(caseId, userId);
            if (!hasAccess) {
                throw new Error('Access denied to case files');
            }

            const {
                searchTerm = '',
                category = null,
                dateFrom = null,
                dateTo = null,
                fileTypes = [],
                tags = [],
                folderId = null
            } = searchParams;

            const filters = {
                category,
                dateFrom,
                dateTo,
                folderId
            };

            let files = await CaseFilestoreService.searchCaseFiles(caseId, searchTerm, filters);

            // Apply additional filtering
            if (fileTypes.length > 0) {
                files = files.filter(file => 
                    fileTypes.some(type => file.mime_type?.includes(type))
                );
            }

            if (tags.length > 0) {
                files = files.filter(file => 
                    file.tags?.some(tag => tags.includes(tag))
                );
            }

            // Enhance with metadata
            const enhancedFiles = files.map(file => ({
                ...file,
                file_size_formatted: this.formatFileSize(file.file_size),
                age_days: this.calculateAgeDays(file.uploaded_at),
                is_recent: this.isRecentFile(file.uploaded_at),
                security_level: this.getSecurityLevel(file.document_category),
                download_url: `/api/files/${file.id}/download`,
                preview_available: this.canPreview(file.mime_type)
            }));

            return {
                case_id: caseId,
                search_term: searchTerm,
                filters_applied: Object.keys(filters).filter(k => filters[k] !== null),
                total_found: enhancedFiles.length,
                files: enhancedFiles,
                search_performed_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error searching case files:', error);
            throw error;
        }
    }

    /**
     * Get file content and metadata for AI processing
     */
    async getFileForProcessing(fileId, userId, options = {}) {
        try {
            const file = await this.getFileMetadata(fileId);
            const hasAccess = await this.verifyCaseAccess(file.case_id, userId);
            
            if (!hasAccess) {
                throw new Error('Access denied to file');
            }

            const result = {
                file_id: fileId,
                metadata: file,
                content: null,
                extracted_text: null,
                analysis: null
            };

            // Get file content based on type
            if (options.includeContent) {
                if (file.mime_type.includes('text/')) {
                    result.content = await this.getTextFileContent(file.file_path);
                } else if (file.mime_type.includes('application/pdf')) {
                    result.extracted_text = await this.extractPDFText(file.file_path);
                } else if (file.mime_type.includes('image/')) {
                    result.analysis = await this.analyzeImageFile(file.file_path);
                }
            }

            // Add processing history
            if (options.includeHistory) {
                result.processing_history = await this.getFileProcessingHistory(fileId);
            }

            // Add related files
            if (options.includeRelated) {
                result.related_files = await this.getRelatedFiles(file.case_id, file.document_category);
            }

            return result;

        } catch (error) {
            console.error('Error getting file for processing:', error);
            throw error;
        }
    }

    /**
     * Organize files using AI classification
     */
    async autoOrganizeFiles(caseId, userId, options = {}) {
        try {
            const hasAccess = await this.verifyCaseAccess(caseId, userId);
            if (!hasAccess) {
                throw new Error('Access denied to case');
            }

            // Get unorganized files (in root or temp folders)
            const unorganizedFiles = await this.getUnorganizedFiles(caseId);
            
            const results = {
                case_id: caseId,
                total_files_processed: 0,
                successfully_organized: 0,
                failed_to_organize: 0,
                results: [],
                processing_errors: []
            };

            for (const file of unorganizedFiles) {
                try {
                    results.total_files_processed++;

                    // Determine document type using AI or rule-based classification
                    const classification = await this.classifyDocument(file);
                    
                    // Auto-organize based on classification
                    const organizationResult = await CaseFilestoreService.autoOrganizeFile(
                        file.id,
                        classification.document_type,
                        classification.subcategory,
                        caseId,
                        userId
                    );

                    if (organizationResult) {
                        results.successfully_organized++;
                        results.results.push({
                            file_id: file.id,
                            filename: file.original_filename,
                            classified_as: classification.document_type,
                            moved_to_folder: organizationResult,
                            confidence: classification.confidence
                        });
                    }

                } catch (error) {
                    results.failed_to_organize++;
                    results.processing_errors.push({
                        file_id: file.id,
                        filename: file.original_filename,
                        error: error.message
                    });
                }
            }

            return results;

        } catch (error) {
            console.error('Error auto-organizing files:', error);
            throw error;
        }
    }

    /**
     * Generate file summary report for case
     */
    async generateFileSummaryReport(caseId, userId) {
        try {
            const hasAccess = await this.verifyCaseAccess(caseId, userId);
            if (!hasAccess) {
                throw new Error('Access denied to case');
            }

            const client = await pool.connect();
            
            // Get comprehensive file statistics
            const stats = await client.query(`
                SELECT 
                    COUNT(*) as total_files,
                    COUNT(CASE WHEN is_current_version = true THEN 1 END) as current_files,
                    COUNT(CASE WHEN document_category = 'financial' THEN 1 END) as financial_docs,
                    COUNT(CASE WHEN document_category = 'legal' THEN 1 END) as legal_docs,
                    COUNT(CASE WHEN document_category = 'correspondence' THEN 1 END) as correspondence,
                    COUNT(CASE WHEN document_category = 'generated' THEN 1 END) as generated_docs,
                    SUM(file_size) as total_storage_bytes,
                    MIN(uploaded_at) as oldest_file,
                    MAX(uploaded_at) as newest_file,
                    COUNT(CASE WHEN uploaded_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as files_last_30_days
                FROM files 
                WHERE case_id = $1
            `, [caseId]);

            // Get folder distribution
            const folderStats = await client.query(`
                SELECT 
                    cf.folder_name,
                    cf.folder_path,
                    COUNT(f.id) as file_count,
                    SUM(f.file_size) as folder_size_bytes
                FROM case_folders cf
                LEFT JOIN files f ON cf.id = f.folder_id AND f.is_current_version = true
                WHERE cf.case_id = $1
                GROUP BY cf.id, cf.folder_name, cf.folder_path
                ORDER BY file_count DESC
            `, [caseId]);

            // Get file type distribution
            const typeStats = await client.query(`
                SELECT 
                    mime_type,
                    COUNT(*) as count,
                    SUM(file_size) as total_size
                FROM files 
                WHERE case_id = $1 AND is_current_version = true
                GROUP BY mime_type
                ORDER BY count DESC
            `, [caseId]);

            // Get recent activity
            const recentActivity = await client.query(`
                SELECT 
                    f.original_filename,
                    f.uploaded_at,
                    f.document_category,
                    u.first_name,
                    u.last_name,
                    cf.folder_name
                FROM files f
                LEFT JOIN users u ON f.uploaded_by = u.id
                LEFT JOIN case_folders cf ON f.folder_id = cf.id
                WHERE f.case_id = $1 AND f.is_current_version = true
                ORDER BY f.uploaded_at DESC
                LIMIT 10
            `, [caseId]);

            client.release();

            const baseStats = stats.rows[0];
            
            return {
                case_id: caseId,
                summary: {
                    total_files: parseInt(baseStats.total_files),
                    current_version_files: parseInt(baseStats.current_files),
                    total_storage: this.formatFileSize(baseStats.total_storage_bytes || 0),
                    date_range: {
                        oldest: baseStats.oldest_file,
                        newest: baseStats.newest_file
                    },
                    recent_uploads: parseInt(baseStats.files_last_30_days)
                },
                categories: {
                    financial: parseInt(baseStats.financial_docs),
                    legal: parseInt(baseStats.legal_docs),
                    correspondence: parseInt(baseStats.correspondence),
                    generated: parseInt(baseStats.generated_docs)
                },
                folders: folderStats.rows.map(folder => ({
                    ...folder,
                    file_count: parseInt(folder.file_count),
                    size_formatted: this.formatFileSize(folder.folder_size_bytes || 0)
                })),
                file_types: typeStats.rows.map(type => ({
                    ...type,
                    count: parseInt(type.count),
                    size_formatted: this.formatFileSize(type.total_size || 0)
                })),
                recent_activity: recentActivity.rows.map(activity => ({
                    ...activity,
                    uploader: `${activity.first_name} ${activity.last_name}`,
                    days_ago: Math.floor((new Date() - new Date(activity.uploaded_at)) / (1000 * 60 * 60 * 24))
                })),
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error generating file summary report:', error);
            throw error;
        }
    }

    // Helper methods
    async verifyCaseAccess(caseId, userId) {
        try {
            const client = await pool.connect();
            const result = await client.query(`
                SELECT c.id, c.centre_id
                FROM cases c
                JOIN users u ON u.centre_id = c.centre_id
                WHERE c.id = $1 AND u.id = $2
            `, [caseId, userId]);
            client.release();
            return result.rows.length > 0;
        } catch (error) {
            return false;
        }
    }

    async getFileMetadata(fileId) {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT f.*, cf.folder_name, cf.folder_path,
                   u.first_name, u.last_name,
                   ARRAY_AGG(dt.tag_name) FILTER (WHERE dt.tag_name IS NOT NULL) as tags
            FROM files f
            LEFT JOIN case_folders cf ON f.folder_id = cf.id
            LEFT JOIN users u ON f.uploaded_by = u.id
            LEFT JOIN file_tags ft ON f.id = ft.file_id
            LEFT JOIN document_tags dt ON ft.tag_id = dt.id
            WHERE f.id = $1 AND f.is_current_version = true
            GROUP BY f.id, cf.folder_name, cf.folder_path, u.first_name, u.last_name
        `, [fileId]);
        client.release();
        
        if (result.rows.length === 0) {
            throw new Error('File not found');
        }
        
        return result.rows[0];
    }

    async getRecentFilesInFolder(folderId, limit = 5) {
        const files = await CaseFilestoreService.getFilesInFolder(folderId);
        return files
            .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
            .slice(0, limit);
    }

    async getFolderLastModified(folderId) {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT MAX(uploaded_at) as last_modified
            FROM files
            WHERE folder_id = $1 AND is_current_version = true
        `, [folderId]);
        client.release();
        return result.rows[0]?.last_modified || null;
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
    }

    calculateAgeDays(uploadedAt) {
        return Math.floor((new Date() - new Date(uploadedAt)) / (1000 * 60 * 60 * 24));
    }

    isRecentFile(uploadedAt, days = 7) {
        return this.calculateAgeDays(uploadedAt) <= days;
    }

    getSecurityLevel(category) {
        const levels = {
            'financial': 'high',
            'legal': 'high',
            'correspondence': 'medium',
            'generated': 'low',
            'other': 'medium'
        };
        return levels[category] || 'medium';
    }

    canPreview(mimeType) {
        const previewable = [
            'application/pdf',
            'text/plain',
            'text/csv',
            'image/jpeg',
            'image/png',
            'image/gif'
        ];
        return previewable.some(type => mimeType?.includes(type));
    }

    async getUnorganizedFiles(caseId) {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT f.*
            FROM files f
            LEFT JOIN case_folders cf ON f.folder_id = cf.id
            WHERE f.case_id = $1 
            AND f.is_current_version = true
            AND (cf.folder_path = '/scanned_documents' OR cf.folder_path IS NULL)
        `, [caseId]);
        client.release();
        return result.rows;
    }

    async classifyDocument(file) {
        // Simple rule-based classification (could be enhanced with AI)
        const filename = file.original_filename.toLowerCase();
        const classifications = [
            { keywords: ['bank', 'statement'], type: 'bank_statement', confidence: 0.9 },
            { keywords: ['benefit', 'allowance', 'esa', 'pip', 'uc'], type: 'benefit_letter', confidence: 0.8 },
            { keywords: ['court', 'order', 'summons'], type: 'court_order', confidence: 0.9 },
            { keywords: ['payslip', 'wage', 'salary'], type: 'employment_document', confidence: 0.8 },
            { keywords: ['utility', 'bill', 'gas', 'electric'], type: 'utility_bill', confidence: 0.7 }
        ];

        for (const classification of classifications) {
            if (classification.keywords.some(keyword => filename.includes(keyword))) {
                return {
                    document_type: classification.type,
                    subcategory: null,
                    confidence: classification.confidence
                };
            }
        }

        return {
            document_type: 'other',
            subcategory: null,
            confidence: 0.5
        };
    }

    // MCP Tool Definitions for n8n integration
    getToolDefinitions() {
        return [
            {
                name: 'get_case_file_structure',
                description: 'Get organized folder structure for a client case',
                inputSchema: {
                    type: 'object',
                    properties: {
                        case_id: { type: 'integer', description: 'Case ID to get files for' }
                    },
                    required: ['case_id']
                }
            },
            {
                name: 'search_case_files',
                description: 'Search for files within a case with advanced filtering',
                inputSchema: {
                    type: 'object',
                    properties: {
                        case_id: { type: 'integer', description: 'Case ID to search in' },
                        search_term: { type: 'string', description: 'Text to search for in filenames' },
                        category: { type: 'string', enum: ['financial', 'legal', 'correspondence', 'generated'] },
                        file_types: { type: 'array', items: { type: 'string' }, description: 'MIME types to filter by' },
                        date_from: { type: 'string', format: 'date' },
                        date_to: { type: 'string', format: 'date' }
                    },
                    required: ['case_id']
                }
            },
            {
                name: 'get_file_for_processing',
                description: 'Get file content and metadata for AI processing',
                inputSchema: {
                    type: 'object',
                    properties: {
                        file_id: { type: 'integer', description: 'File ID to process' },
                        include_content: { type: 'boolean', description: 'Whether to include file content' },
                        include_history: { type: 'boolean', description: 'Whether to include processing history' }
                    },
                    required: ['file_id']
                }
            },
            {
                name: 'auto_organize_files',
                description: 'Automatically organize unorganized files using AI classification',
                inputSchema: {
                    type: 'object',
                    properties: {
                        case_id: { type: 'integer', description: 'Case ID to organize files for' }
                    },
                    required: ['case_id']
                }
            },
            {
                name: 'generate_file_summary_report',
                description: 'Generate comprehensive file summary report for a case',
                inputSchema: {
                    type: 'object',
                    properties: {
                        case_id: { type: 'integer', description: 'Case ID to generate report for' }
                    },
                    required: ['case_id']
                }
            }
        ];
    }
}

module.exports = new ClientFilesMCP();
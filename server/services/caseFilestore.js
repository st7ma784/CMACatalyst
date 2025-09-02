const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CaseFilestoreService {
    constructor() {
        this.baseStoragePath = process.env.FILE_STORAGE_PATH || './uploads';
    }

    // Initialize default folder structure for a new case
    async initializeCaseFolders(caseId, userId) {
        const defaultFolders = [
            { name: 'Financial Documents', path: '/financial_documents', type: 'system' },
            { name: 'Bank Statements', path: '/financial_documents/bank_statements', type: 'system' },
            { name: 'Benefit Letters', path: '/financial_documents/benefit_letters', type: 'system' },
            { name: 'Income Documents', path: '/financial_documents/income_documents', type: 'system' },
            { name: 'Legal Documents', path: '/legal_documents', type: 'system' },
            { name: 'Court Orders', path: '/legal_documents/court_orders', type: 'system' },
            { name: 'Agreements', path: '/legal_documents/agreements', type: 'system' },
            { name: 'Correspondence', path: '/correspondence', type: 'system' },
            { name: 'Letters Sent', path: '/correspondence/letters_sent', type: 'system' },
            { name: 'Letters Received', path: '/correspondence/letters_received', type: 'system' },
            { name: 'Generated Documents', path: '/generated_documents', type: 'system' },
            { name: 'Workflow Outputs', path: '/generated_documents/workflow_outputs', type: 'system' },
            { name: 'Reports', path: '/generated_documents/reports', type: 'system' },
            { name: 'Supporting Evidence', path: '/supporting_evidence', type: 'system' },
            { name: 'Scanned Documents', path: '/scanned_documents', type: 'system' }
        ];

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const folderMap = new Map();

            for (const folder of defaultFolders) {
                const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/')) || null;
                const parentId = parentPath ? folderMap.get(parentPath) : null;

                const result = await client.query(`
                    INSERT INTO case_folders (case_id, folder_name, folder_path, parent_folder_id, folder_type, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (case_id, folder_path) DO NOTHING
                    RETURNING id
                `, [caseId, folder.name, folder.path, parentId, folder.type, userId]);

                if (result.rows.length > 0) {
                    folderMap.set(folder.path, result.rows[0].id);
                }
            }

            await client.query('COMMIT');
            return folderMap;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Create a new folder
    async createFolder(caseId, folderName, parentPath, userId) {
        const client = await pool.connect();
        try {
            // Get parent folder ID if specified
            let parentId = null;
            if (parentPath) {
                const parentResult = await client.query(
                    'SELECT id FROM case_folders WHERE case_id = $1 AND folder_path = $2',
                    [caseId, parentPath]
                );
                if (parentResult.rows.length === 0) {
                    throw new Error('Parent folder not found');
                }
                parentId = parentResult.rows[0].id;
            }

            // Generate folder path
            const folderPath = parentPath ? `${parentPath}/${folderName.toLowerCase().replace(/\s+/g, '_')}` : `/${folderName.toLowerCase().replace(/\s+/g, '_')}`;

            const result = await client.query(`
                INSERT INTO case_folders (case_id, folder_name, folder_path, parent_folder_id, folder_type, created_by)
                VALUES ($1, $2, $3, $4, 'user_created', $5)
                RETURNING *
            `, [caseId, folderName, folderPath, parentId, userId]);

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    // Get folder structure for a case
    async getCaseFolderStructure(caseId) {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT cf.*, 
                       COUNT(f.id) as file_count,
                       u.name as created_by_name
                FROM case_folders cf
                LEFT JOIN files f ON cf.id = f.folder_id AND f.is_current_version = true
                LEFT JOIN users u ON cf.created_by = u.id
                WHERE cf.case_id = $1
                GROUP BY cf.id, u.name
                ORDER BY cf.folder_path
            `, [caseId]);

            return this.buildFolderTree(result.rows);
        } finally {
            client.release();
        }
    }

    // Build hierarchical folder tree
    buildFolderTree(folders) {
        const folderMap = new Map();
        const rootFolders = [];

        // Create folder objects
        folders.forEach(folder => {
            folderMap.set(folder.id, {
                ...folder,
                children: []
            });
        });

        // Build hierarchy
        folders.forEach(folder => {
            const folderObj = folderMap.get(folder.id);
            if (folder.parent_folder_id) {
                const parent = folderMap.get(folder.parent_folder_id);
                if (parent) {
                    parent.children.push(folderObj);
                }
            } else {
                rootFolders.push(folderObj);
            }
        });

        return rootFolders;
    }

    // Move file to folder
    async moveFileToFolder(fileId, folderId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update file location
            await client.query(
                'UPDATE files SET folder_id = $1 WHERE id = $2',
                [folderId, fileId]
            );

            // Log the action
            await this.logDocumentAction(fileId, 'moved', userId, { 
                new_folder_id: folderId 
            });

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Organize file automatically based on document type
    async autoOrganizeFile(fileId, documentType, documentSubcategory, caseId, userId) {
        const client = await pool.connect();
        try {
            // Map document types to folder paths
            const folderMapping = {
                'bank_statement': '/financial_documents/bank_statements',
                'benefit_letter': '/financial_documents/benefit_letters',
                'court_order': '/legal_documents/court_orders',
                'utility_bill': '/financial_documents/income_documents',
                'employment_document': '/financial_documents/income_documents',
                'credit_report': '/financial_documents',
                'generated_letter': '/generated_documents',
                'workflow_output': '/generated_documents/workflow_outputs'
            };

            const targetPath = folderMapping[documentType] || '/scanned_documents';

            // Find the target folder
            const folderResult = await client.query(
                'SELECT id FROM case_folders WHERE case_id = $1 AND folder_path = $2',
                [caseId, targetPath]
            );

            if (folderResult.rows.length > 0) {
                const folderId = folderResult.rows[0].id;

                // Update file with folder and categorization
                await client.query(`
                    UPDATE files 
                    SET folder_id = $1, 
                        document_category = $2, 
                        document_subcategory = $3
                    WHERE id = $4
                `, [folderId, this.getCategoryFromType(documentType), documentSubcategory, fileId]);

                // Log the auto-organization
                await this.logDocumentAction(fileId, 'auto_organized', userId, {
                    document_type: documentType,
                    target_folder: targetPath
                });

                return folderId;
            }

            return null;
        } finally {
            client.release();
        }
    }

    // Get category from document type
    getCategoryFromType(documentType) {
        const categoryMap = {
            'bank_statement': 'financial',
            'benefit_letter': 'financial',
            'court_order': 'legal',
            'utility_bill': 'financial',
            'employment_document': 'financial',
            'credit_report': 'financial',
            'generated_letter': 'correspondence',
            'workflow_output': 'generated'
        };
        return categoryMap[documentType] || 'other';
    }

    // Calculate file hash for duplicate detection
    async calculateFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            return crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (error) {
            console.error('Error calculating file hash:', error);
            return null;
        }
    }

    // Check for duplicate files
    async checkForDuplicates(caseId, fileHash) {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT f.*, cf.folder_path
                FROM files f
                LEFT JOIN case_folders cf ON f.folder_id = cf.id
                WHERE f.case_id = $1 AND f.file_hash = $2 AND f.is_current_version = true
            `, [caseId, fileHash]);

            return result.rows;
        } finally {
            client.release();
        }
    }

    // Create new file version
    async createFileVersion(originalFileId, newFilePath, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get original file info
            const originalResult = await client.query(
                'SELECT * FROM files WHERE id = $1',
                [originalFileId]
            );

            if (originalResult.rows.length === 0) {
                throw new Error('Original file not found');
            }

            const originalFile = originalResult.rows[0];

            // Mark original as not current
            await client.query(
                'UPDATE files SET is_current_version = false WHERE id = $1',
                [originalFileId]
            );

            // Calculate new version number
            const versionResult = await client.query(
                'SELECT MAX(version_number) as max_version FROM files WHERE case_id = $1 AND filename = $2',
                [originalFile.case_id, originalFile.filename]
            );

            const newVersion = (versionResult.rows[0].max_version || 0) + 1;
            const fileHash = await this.calculateFileHash(newFilePath);

            // Create new version
            const newFileResult = await client.query(`
                INSERT INTO files (
                    case_id, filename, original_filename, file_path, file_size, mime_type,
                    folder_id, document_category, document_subcategory, is_generated,
                    generation_source, version_number, is_current_version, file_hash,
                    uploaded_by, uploaded_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $14, CURRENT_TIMESTAMP)
                RETURNING *
            `, [
                originalFile.case_id,
                originalFile.filename,
                originalFile.original_filename,
                newFilePath,
                originalFile.file_size,
                originalFile.mime_type,
                originalFile.folder_id,
                originalFile.document_category,
                originalFile.document_subcategory,
                originalFile.is_generated,
                originalFile.generation_source,
                newVersion,
                fileHash,
                userId
            ]);

            // Update original file to point to replacement
            await client.query(
                'UPDATE files SET replaced_by = $1 WHERE id = $2',
                [newFileResult.rows[0].id, originalFileId]
            );

            // Log the versioning action
            await this.logDocumentAction(newFileResult.rows[0].id, 'version_created', userId, {
                original_file_id: originalFileId,
                version_number: newVersion
            });

            await client.query('COMMIT');
            return newFileResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Log document actions for audit trail
    async logDocumentAction(fileId, action, userId, details = {}, req = null) {
        const client = await pool.connect();
        try {
            await client.query(`
                INSERT INTO document_audit_log (
                    file_id, action, performed_by, details, ip_address, user_agent
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                fileId,
                action,
                userId,
                JSON.stringify(details),
                req?.ip || null,
                req?.get('User-Agent') || null
            ]);
        } finally {
            client.release();
        }
    }

    // Get file audit history
    async getFileAuditHistory(fileId) {
        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT dal.*, u.name as performed_by_name
                FROM document_audit_log dal
                LEFT JOIN users u ON dal.performed_by = u.id
                WHERE dal.file_id = $1
                ORDER BY dal.performed_at DESC
            `, [fileId]);

            return result.rows;
        } finally {
            client.release();
        }
    }

    // Add tags to file
    async addFileTag(fileId, tagName, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create tag if it doesn't exist
            const tagResult = await client.query(`
                INSERT INTO document_tags (tag_name, created_by)
                VALUES ($1, $2)
                ON CONFLICT (tag_name) DO UPDATE SET tag_name = EXCLUDED.tag_name
                RETURNING id
            `, [tagName, userId]);

            const tagId = tagResult.rows[0].id;

            // Add tag to file
            await client.query(`
                INSERT INTO file_tags (file_id, tag_id, tagged_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (file_id, tag_id) DO NOTHING
            `, [fileId, tagId, userId]);

            await client.query('COMMIT');
            return tagId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Get files in folder with metadata
    async getFilesInFolder(folderId, includeSubfolders = false) {
        const client = await pool.connect();
        try {
            let query = `
                SELECT f.*, cf.folder_name, cf.folder_path,
                       u.name as uploaded_by_name,
                       ARRAY_AGG(dt.tag_name) FILTER (WHERE dt.tag_name IS NOT NULL) as tags
                FROM files f
                LEFT JOIN case_folders cf ON f.folder_id = cf.id
                LEFT JOIN users u ON f.uploaded_by = u.id
                LEFT JOIN file_tags ft ON f.id = ft.file_id
                LEFT JOIN document_tags dt ON ft.tag_id = dt.id
                WHERE f.folder_id = $1 AND f.is_current_version = true
                GROUP BY f.id, cf.folder_name, cf.folder_path, u.name
                ORDER BY f.uploaded_at DESC
            `;

            const result = await client.query(query, [folderId]);
            return result.rows;
        } finally {
            client.release();
        }
    }

    // Search files across case
    async searchCaseFiles(caseId, searchTerm, filters = {}) {
        const client = await pool.connect();
        try {
            let query = `
                SELECT f.*, cf.folder_name, cf.folder_path,
                       u.name as uploaded_by_name,
                       ARRAY_AGG(dt.tag_name) FILTER (WHERE dt.tag_name IS NOT NULL) as tags
                FROM files f
                LEFT JOIN case_folders cf ON f.folder_id = cf.id
                LEFT JOIN users u ON f.uploaded_by = u.id
                LEFT JOIN file_tags ft ON f.id = ft.file_id
                LEFT JOIN document_tags dt ON ft.tag_id = dt.id
                WHERE f.case_id = $1 AND f.is_current_version = true
            `;

            const params = [caseId];
            let paramIndex = 2;

            if (searchTerm) {
                query += ` AND (f.original_filename ILIKE $${paramIndex} OR f.description ILIKE $${paramIndex})`;
                params.push(`%${searchTerm}%`);
                paramIndex++;
            }

            if (filters.category) {
                query += ` AND f.document_category = $${paramIndex}`;
                params.push(filters.category);
                paramIndex++;
            }

            if (filters.folderId) {
                query += ` AND f.folder_id = $${paramIndex}`;
                params.push(filters.folderId);
                paramIndex++;
            }

            if (filters.dateFrom) {
                query += ` AND f.uploaded_at >= $${paramIndex}`;
                params.push(filters.dateFrom);
                paramIndex++;
            }

            if (filters.dateTo) {
                query += ` AND f.uploaded_at <= $${paramIndex}`;
                params.push(filters.dateTo);
                paramIndex++;
            }

            query += ` GROUP BY f.id, cf.folder_name, cf.folder_path, u.name ORDER BY f.uploaded_at DESC`;

            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    }
}

module.exports = new CaseFilestoreService();

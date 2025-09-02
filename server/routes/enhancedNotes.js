const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all notes for a case with enhanced filtering
router.get('/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { 
            category, 
            priority, 
            tags, 
            user_id, 
            from_date, 
            to_date,
            search,
            page = 1,
            limit = 20
        } = req.query;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        let query = `
            SELECT n.*, u.first_name, u.last_name, u.email,
                   array_agg(DISTINCT na.file_id) FILTER (WHERE na.file_id IS NOT NULL) as attachment_ids,
                   array_agg(DISTINCT f.filename) FILTER (WHERE f.filename IS NOT NULL) as attachment_names
            FROM notes n
            JOIN users u ON n.user_id = u.id
            LEFT JOIN note_attachments na ON n.id = na.note_id
            LEFT JOIN files f ON na.file_id = f.id
            WHERE n.case_id = $1
        `;
        
        const params = [caseId];
        let paramCount = 1;

        // Add filters
        if (category) {
            paramCount++;
            query += ` AND n.note_category = $${paramCount}`;
            params.push(category);
        }

        if (priority) {
            paramCount++;
            query += ` AND n.priority_level = $${paramCount}`;
            params.push(priority);
        }

        if (user_id) {
            paramCount++;
            query += ` AND n.user_id = $${paramCount}`;
            params.push(user_id);
        }

        if (tags) {
            paramCount++;
            query += ` AND n.tags && $${paramCount}`;
            params.push(tags.split(','));
        }

        if (from_date) {
            paramCount++;
            query += ` AND n.created_at >= $${paramCount}`;
            params.push(from_date);
        }

        if (to_date) {
            paramCount++;
            query += ` AND n.created_at <= $${paramCount}`;
            params.push(to_date);
        }

        if (search) {
            paramCount++;
            query += ` AND (n.title ILIKE $${paramCount} OR n.content ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        query += `
            GROUP BY n.id, u.first_name, u.last_name, u.email
            ORDER BY n.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;
        
        params.push(limit, (page - 1) * limit);

        const result = await pool.query(query, params);

        // Get follow-up actions for each note
        const noteIds = result.rows.map(note => note.id);
        let followUps = [];
        
        if (noteIds.length > 0) {
            const followUpQuery = `
                SELECT nf.*, u.first_name, u.last_name
                FROM note_follow_ups nf
                LEFT JOIN users u ON nf.assigned_to = u.id
                WHERE nf.note_id = ANY($1)
                ORDER BY nf.due_date ASC
            `;
            const followUpResult = await pool.query(followUpQuery, [noteIds]);
            followUps = followUpResult.rows;
        }

        // Attach follow-ups to notes
        const notesWithFollowUps = result.rows.map(note => ({
            ...note,
            follow_ups: followUps.filter(fu => fu.note_id === note.id)
        }));

        res.json(notesWithFollowUps);
    } catch (error) {
        console.error('Error fetching enhanced notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create structured note with templates
router.post('/structured', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const {
            case_id,
            title,
            content,
            note_category,
            priority_level = 'normal',
            follow_up_date,
            tags = [],
            mentioned_users = [],
            attachments = [],
            follow_up_actions = []
        } = req.body;

        // Verify user has access to this case
        const caseCheck = await client.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [case_id, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Case not found' });
        }

        // Create the note
        const noteResult = await client.query(`
            INSERT INTO notes (case_id, user_id, title, content, note_category, priority_level, follow_up_date, tags, mentioned_users)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [case_id, req.user.id, title, content, note_category, priority_level, follow_up_date, tags, mentioned_users]);

        const note = noteResult.rows[0];

        // Add attachments if provided
        if (attachments.length > 0) {
            for (const fileId of attachments) {
                await client.query(
                    'INSERT INTO note_attachments (note_id, file_id) VALUES ($1, $2)',
                    [note.id, fileId]
                );
            }
        }

        // Add follow-up actions if provided
        if (follow_up_actions.length > 0) {
            for (const action of follow_up_actions) {
                await client.query(`
                    INSERT INTO note_follow_ups (note_id, assigned_to, action_required, due_date)
                    VALUES ($1, $2, $3, $4)
                `, [note.id, action.assigned_to, action.action_required, action.due_date]);
            }
        }

        await client.query('COMMIT');

        // Fetch the complete note with attachments and follow-ups
        const completeNote = await pool.query(`
            SELECT n.*, u.first_name, u.last_name,
                   array_agg(DISTINCT na.file_id) FILTER (WHERE na.file_id IS NOT NULL) as attachment_ids,
                   array_agg(DISTINCT f.filename) FILTER (WHERE f.filename IS NOT NULL) as attachment_names
            FROM notes n
            JOIN users u ON n.user_id = u.id
            LEFT JOIN note_attachments na ON n.id = na.note_id
            LEFT JOIN files f ON na.file_id = f.id
            WHERE n.id = $1
            GROUP BY n.id, u.first_name, u.last_name
        `, [note.id]);

        res.status(201).json(completeNote.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating structured note:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Full-text search with filters
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const {
            q: searchQuery,
            category,
            priority,
            tags,
            centre_id = req.user.centre_id,
            page = 1,
            limit = 20
        } = req.query;

        if (!searchQuery) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        let query = `
            SELECT n.*, u.first_name, u.last_name, c.id as case_id, cl.first_name as client_first_name, cl.last_name as client_last_name,
                   ts_rank(to_tsvector('english', n.title || ' ' || n.content), plainto_tsquery('english', $1)) as rank
            FROM notes n
            JOIN users u ON n.user_id = u.id
            JOIN cases c ON n.case_id = c.id
            JOIN clients cl ON c.client_id = cl.id
            WHERE c.centre_id = $2
            AND to_tsvector('english', n.title || ' ' || n.content) @@ plainto_tsquery('english', $1)
        `;

        const params = [searchQuery, centre_id];
        let paramCount = 2;

        if (category) {
            paramCount++;
            query += ` AND n.note_category = $${paramCount}`;
            params.push(category);
        }

        if (priority) {
            paramCount++;
            query += ` AND n.priority_level = $${paramCount}`;
            params.push(priority);
        }

        if (tags) {
            paramCount++;
            query += ` AND n.tags && $${paramCount}`;
            params.push(tags.split(','));
        }

        query += `
            ORDER BY rank DESC, n.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        params.push(limit, (page - 1) * limit);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Schedule follow-up actions
router.post('/:noteId/follow-up', authenticateToken, async (req, res) => {
    try {
        const { noteId } = req.params;
        const { assigned_to, action_required, due_date } = req.body;

        // Verify note exists and user has access
        const noteCheck = await pool.query(`
            SELECT n.id FROM notes n
            JOIN cases c ON n.case_id = c.id
            WHERE n.id = $1 AND c.centre_id = $2
        `, [noteId, req.user.centre_id]);

        if (noteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const result = await pool.query(`
            INSERT INTO note_follow_ups (note_id, assigned_to, action_required, due_date)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [noteId, assigned_to, action_required, due_date]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating follow-up:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get note templates by category
router.get('/templates/category/:category', authenticateToken, async (req, res) => {
    try {
        const { category } = req.params;

        const result = await pool.query(`
            SELECT * FROM note_templates
            WHERE centre_id = $1 AND category = $2 AND is_active = true
            ORDER BY name ASC
        `, [req.user.centre_id, category]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching note templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Bulk operations for case transfers
router.post('/bulk-update', authenticateToken, requireRole(['manager']), async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { note_ids, updates } = req.body;
        const allowedUpdates = ['note_category', 'priority_level', 'tags'];
        
        // Validate updates
        const updateFields = Object.keys(updates).filter(key => allowedUpdates.includes(key));
        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No valid update fields provided' });
        }

        // Verify all notes belong to user's centre
        const noteCheck = await client.query(`
            SELECT n.id FROM notes n
            JOIN cases c ON n.case_id = c.id
            WHERE n.id = ANY($1) AND c.centre_id = $2
        `, [note_ids, req.user.centre_id]);

        if (noteCheck.rows.length !== note_ids.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Some notes not found or access denied' });
        }

        // Build update query
        const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
        const values = [note_ids, ...updateFields.map(field => updates[field])];

        const updateQuery = `
            UPDATE notes SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($1)
            RETURNING id
        `;

        const result = await client.query(updateQuery, values);
        await client.query('COMMIT');

        res.json({ 
            message: `Updated ${result.rows.length} notes`,
            updated_ids: result.rows.map(row => row.id)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulk updating notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Get notes with pending follow-ups for a user
router.get('/follow-ups/pending', authenticateToken, async (req, res) => {
    try {
        const { user_id = req.user.id } = req.query;

        const result = await pool.query(`
            SELECT nf.*, n.title as note_title, n.content as note_content,
                   c.id as case_id, cl.first_name as client_first_name, cl.last_name as client_last_name,
                   u.first_name, u.last_name
            FROM note_follow_ups nf
            JOIN notes n ON nf.note_id = n.id
            JOIN cases c ON n.case_id = c.id
            JOIN clients cl ON c.client_id = cl.id
            JOIN users u ON nf.assigned_to = u.id
            WHERE nf.assigned_to = $1 AND nf.status = 'pending'
            AND c.centre_id = $2
            ORDER BY nf.due_date ASC NULLS LAST, nf.created_at ASC
        `, [user_id, req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending follow-ups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update follow-up status
router.put('/follow-ups/:followUpId', authenticateToken, async (req, res) => {
    try {
        const { followUpId } = req.params;
        const { status, completion_notes } = req.body;

        const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Verify follow-up exists and user has access
        const followUpCheck = await pool.query(`
            SELECT nf.id FROM note_follow_ups nf
            JOIN notes n ON nf.note_id = n.id
            JOIN cases c ON n.case_id = c.id
            WHERE nf.id = $1 AND c.centre_id = $2
        `, [followUpId, req.user.centre_id]);

        if (followUpCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Follow-up not found' });
        }

        const updateData = { status };
        if (status === 'completed') {
            updateData.completed_at = new Date();
            updateData.completed_by = req.user.id;
        }

        const result = await pool.query(`
            UPDATE note_follow_ups 
            SET status = $1, completed_at = $2, completed_by = $3
            WHERE id = $4
            RETURNING *
        `, [status, updateData.completed_at || null, updateData.completed_by || null, followUpId]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating follow-up:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

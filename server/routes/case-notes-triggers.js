const express = require('express');
const router = express.Router();
const axios = require('axios');

// Configuration
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
const RAG_INGESTION_URL = process.env.RAG_INGESTION_URL || 'http://rag-ingestion:8004';

/**
 * Middleware to trigger N8N workflows when case notes are modified
 */

/**
 * @swagger
 * /api/case-notes/create:
 *   post:
 *     summary: Create case note with RAG enhancement
 *     tags: [Case Notes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               case_id:
 *                 type: string
 *                 description: Case ID
 *               note_content:
 *                 type: string
 *                 description: Note content
 *               note_type:
 *                 type: string
 *                 description: Type of note (assessment, advice, follow-up)
 *               advisor_id:
 *                 type: string
 *                 description: ID of advisor creating note
 *               client_situation:
 *                 type: string
 *                 description: Brief description of client situation
 *     responses:
 *       200:
 *         description: Note created and RAG review triggered
 */
router.post('/create', async (req, res) => {
  try {
    const { case_id, note_content, note_type, advisor_id, client_situation } = req.body;

    // First, create the note in the database (existing logic)
    // This would typically call your existing note creation endpoint
    const noteCreationResponse = await createNoteInDatabase({
      case_id,
      note_content,
      note_type,
      advisor_id,
      client_situation
    });

    const note_id = noteCreationResponse.note_id;

    // Trigger N8N workflow for RAG review and enhancement
    await triggerNoteReviewWorkflow({
      note_id,
      case_id,
      note_content,
      note_type,
      advisor_id,
      client_situation,
      action: 'create'
    });

    res.json({
      success: true,
      note_id,
      message: 'Note created and RAG review initiated',
      rag_review_status: 'pending'
    });

  } catch (error) {
    console.error('Case note creation error:', error);
    res.status(500).json({ error: 'Failed to create note with RAG enhancement' });
  }
});

/**
 * @swagger
 * /api/case-notes/update:
 *   put:
 *     summary: Update case note with RAG re-analysis
 *     tags: [Case Notes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note_id:
 *                 type: string
 *                 description: Note ID
 *               note_content:
 *                 type: string
 *                 description: Updated note content
 *               changes_summary:
 *                 type: string
 *                 description: Summary of what changed
 *     responses:
 *       200:
 *         description: Note updated and RAG review triggered
 */
router.put('/update', async (req, res) => {
  try {
    const { note_id, note_content, changes_summary } = req.body;

    // Get existing note details
    const existingNote = await getNoteFromDatabase(note_id);

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Update the note in database
    await updateNoteInDatabase(note_id, note_content);

    // Trigger N8N workflow for RAG re-analysis
    await triggerNoteReviewWorkflow({
      note_id,
      case_id: existingNote.case_id,
      note_content,
      note_type: existingNote.note_type,
      advisor_id: existingNote.advisor_id,
      client_situation: existingNote.client_situation,
      changes_summary,
      action: 'update'
    });

    res.json({
      success: true,
      note_id,
      message: 'Note updated and RAG re-analysis initiated',
      rag_review_status: 'pending'
    });

  } catch (error) {
    console.error('Case note update error:', error);
    res.status(500).json({ error: 'Failed to update note with RAG enhancement' });
  }
});

/**
 * @swagger
 * /api/case-notes/finalize:
 *   post:
 *     summary: Finalize case note and add to vector store
 *     tags: [Case Notes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note_id:
 *                 type: string
 *                 description: Note ID
 *               final_content:
 *                 type: string
 *                 description: Final note content after RAG enhancement
 *               training_links:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Linked training manual sections
 *     responses:
 *       200:
 *         description: Note finalized and added to knowledge base
 */
router.post('/finalize', async (req, res) => {
  try {
    const { note_id, final_content, training_links } = req.body;

    // Update note with final enhanced content
    await updateNoteInDatabase(note_id, final_content, {
      rag_enhanced: true,
      training_links
    });

    // Add to vector store for future similarity searches
    const noteDetails = await getNoteFromDatabase(note_id);

    await addNoteToVectorStore({
      note_id,
      content: final_content,
      metadata: {
        case_id: noteDetails.case_id,
        note_type: noteDetails.note_type,
        client_situation: noteDetails.client_situation,
        advisor_id: noteDetails.advisor_id,
        training_links,
        finalized_at: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      note_id,
      message: 'Note finalized and added to knowledge base',
      vector_store_status: 'added'
    });

  } catch (error) {
    console.error('Case note finalization error:', error);
    res.status(500).json({ error: 'Failed to finalize note' });
  }
});

/**
 * @swagger
 * /api/case-notes/search-similar:
 *   post:
 *     summary: Find similar case notes using RAG
 *     tags: [Case Notes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *               case_type:
 *                 type: string
 *                 description: Type of case to filter by
 *               top_k:
 *                 type: integer
 *                 default: 5
 *                 description: Number of similar cases to return
 *     responses:
 *       200:
 *         description: Similar case notes found
 */
router.post('/search-similar', async (req, res) => {
  try {
    const { query, case_type, top_k = 5 } = req.body;

    // Search in case notes vector collection
    const response = await axios.post(`${RAG_INGESTION_URL}/search`, {
      query,
      collection_name: 'case_notes',
      manual_type: case_type,
      top_k,
      score_threshold: 0.6
    });

    const similarCases = response.data.results.map(result => ({
      note_id: result.metadata.note_id,
      case_id: result.metadata.case_id,
      similarity_score: result.score,
      content_preview: result.content.substring(0, 200) + '...',
      case_type: result.metadata.note_type,
      advisor_id: result.metadata.advisor_id,
      created_date: result.metadata.finalized_at
    }));

    res.json({
      query,
      similar_cases: similarCases,
      total_found: similarCases.length
    });

  } catch (error) {
    console.error('Similar case search error:', error);
    res.status(500).json({ error: 'Failed to search similar cases' });
  }
});

// Helper functions

async function createNoteInDatabase(noteData) {
  // This would integrate with your existing database logic
  // For now, returning mock response
  const note_id = `note_${Date.now()}`;

  // TODO: Replace with actual database insertion
  console.log('Creating note in database:', noteData);

  return { note_id };
}

async function updateNoteInDatabase(note_id, content, metadata = {}) {
  // TODO: Replace with actual database update
  console.log(`Updating note ${note_id} with content:`, content.substring(0, 100));
  return true;
}

async function getNoteFromDatabase(note_id) {
  // TODO: Replace with actual database query
  return {
    note_id,
    case_id: 'case_123',
    note_type: 'assessment',
    advisor_id: 'advisor_456',
    client_situation: 'debt management plan assessment',
    content: 'Sample note content...'
  };
}

async function triggerNoteReviewWorkflow(data) {
  try {
    const response = await axios.post(`${N8N_WEBHOOK_URL}/webhook/case-note-review`, data, {
      timeout: 5000
    });

    console.log('N8N workflow triggered successfully for note:', data.note_id);
    return response.data;
  } catch (error) {
    console.error('Failed to trigger N8N workflow:', error.message);
    // Don't fail the main operation if N8N is unavailable
    return null;
  }
}

async function addNoteToVectorStore(noteData) {
  try {
    const response = await axios.post(`${RAG_INGESTION_URL}/ingest/note`, {
      note_id: noteData.note_id,
      content: noteData.content,
      metadata: noteData.metadata,
      collection_name: 'case_notes'
    });

    console.log('Note added to vector store:', noteData.note_id);
    return response.data;
  } catch (error) {
    console.error('Failed to add note to vector store:', error.message);
    throw error;
  }
}

module.exports = router;
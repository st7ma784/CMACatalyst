import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Autocomplete,
    Alert,
    Tabs,
    Tab,
    Badge
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    ExpandMore as ExpandMoreIcon,
    AttachFile as AttachFileIcon,
    Assignment as AssignmentIcon,
    Schedule as ScheduleIcon,
    FilterList as FilterListIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Description as CoaIcon,
    Translate as TranslateIcon,
    FileCopy as CopyIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';

const EnhancedNotes = ({ caseId, users = [] }) => {
    const [notes, setNotes] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [followUps, setFollowUps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [openFollowUpDialog, setOpenFollowUpDialog] = useState(false);
    const [openCoaDialog, setOpenCoaDialog] = useState(false);
    const [openTranslateDialog, setOpenTranslateDialog] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [coaContent, setCoaContent] = useState('');
    const [coaLoading, setCoaLoading] = useState(false);
    const [translatedContent, setTranslatedContent] = useState('');
    const [translateLoading, setTranslateLoading] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('es');

    // Form states
    const [noteForm, setNoteForm] = useState({
        title: '',
        content: '',
        note_category: '',
        priority_level: 'normal',
        follow_up_date: null,
        tags: [],
        mentioned_users: [],
        attachments: []
    });

    // Filter states
    const [filters, setFilters] = useState({
        category: '',
        priority: '',
        tags: '',
        user_id: '',
        search: ''
    });

    const categories = [
        'initial_assessment',
        'debt_advice',
        'budget_review',
        'creditor_contact',
        'legal_action',
        'compliance',
        'follow_up',
        'client_communication',
        'case_closure'
    ];

    const priorities = ['low', 'normal', 'high', 'urgent'];

    const languages = [
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'pl', name: 'Polish' },
        { code: 'ar', name: 'Arabic' },
        { code: 'ur', name: 'Urdu' },
        { code: 'hi', name: 'Hindi' },
        { code: 'zh', name: 'Chinese' }
    ];

    useEffect(() => {
        if (caseId) {
            fetchNotes();
            fetchPendingFollowUps();
        }
    }, [caseId]);

    useEffect(() => {
        applyFilters();
    }, [notes, filters]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });

            const response = await axios.get(`/api/enhanced-notes/case/${caseId}?${params}`);
            setNotes(response.data);
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingFollowUps = async () => {
        try {
            const response = await axios.get('/api/enhanced-notes/follow-ups/pending');
            setFollowUps(response.data);
        } catch (error) {
            console.error('Error fetching follow-ups:', error);
        }
    };

    const fetchTemplates = async (category) => {
        if (!category) return;
        try {
            const response = await axios.get(`/api/enhanced-notes/templates/category/${category}`);
            setTemplates(response.data);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    const applyFilters = () => {
        let filtered = [...notes];

        if (filters.search) {
            filtered = filtered.filter(note =>
                note.title.toLowerCase().includes(filters.search.toLowerCase()) ||
                note.content.toLowerCase().includes(filters.search.toLowerCase())
            );
        }

        if (filters.category) {
            filtered = filtered.filter(note => note.note_category === filters.category);
        }

        if (filters.priority) {
            filtered = filtered.filter(note => note.priority_level === filters.priority);
        }

        if (filters.user_id) {
            filtered = filtered.filter(note => note.user_id === parseInt(filters.user_id));
        }

        setFilteredNotes(filtered);
    };

    const handleCreateNote = async () => {
        try {
            const response = await axios.post('/api/enhanced-notes/structured', {
                case_id: caseId,
                ...noteForm
            });

            setNotes([response.data, ...notes]);
            setOpenDialog(false);
            resetForm();
        } catch (error) {
            console.error('Error creating note:', error);
        }
    };

    const handleCreateFollowUp = async (followUpData) => {
        try {
            await axios.post(`/api/enhanced-notes/${selectedNote.id}/follow-up`, followUpData);
            setOpenFollowUpDialog(false);
            fetchPendingFollowUps();
        } catch (error) {
            console.error('Error creating follow-up:', error);
        }
    };

    const handleUpdateFollowUp = async (followUpId, status) => {
        try {
            await axios.put(`/api/enhanced-notes/follow-ups/${followUpId}`, { status });
            fetchPendingFollowUps();
        } catch (error) {
            console.error('Error updating follow-up:', error);
        }
    };

    const handleGenerateCoA = async (note) => {
        setSelectedNote(note);
        setCoaLoading(true);
        setOpenCoaDialog(true);
        
        try {
            const response = await axios.post('/api/enhanced-notes/generate-coa', {
                case_id: caseId,
                notes: [note],
                include_case_context: true
            });
            setCoaContent(response.data.confirmation_of_advice);
        } catch (error) {
            console.error('Error generating CoA:', error);
            setCoaContent('Error generating Confirmation of Advice. Please try again.');
        } finally {
            setCoaLoading(false);
        }
    };

    const handleTranslateContent = async (content, targetLanguage) => {
        setTranslateLoading(true);
        setOpenTranslateDialog(true);
        
        try {
            const response = await axios.post('/api/translation/translate', {
                text: content,
                target_language: targetLanguage,
                source_language: 'en'
            });
            setTranslatedContent(response.data.translated_text);
        } catch (error) {
            console.error('Error translating content:', error);
            setTranslatedContent('Translation service temporarily unavailable.');
        } finally {
            setTranslateLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            // Could add a snackbar notification here
        });
    };

    const resetForm = () => {
        setNoteForm({
            title: '',
            content: '',
            note_category: '',
            priority_level: 'normal',
            follow_up_date: null,
            tags: [],
            mentioned_users: [],
            attachments: []
        });
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return 'error';
            case 'high': return 'warning';
            case 'normal': return 'primary';
            case 'low': return 'default';
            default: return 'default';
        }
    };

    const getPriorityIcon = (priority) => {
        switch (priority) {
            case 'urgent':
            case 'high':
                return <WarningIcon fontSize="small" />;
            default:
                return null;
        }
    };

    const TabPanel = ({ children, value, index }) => (
        <div hidden={value !== index}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box>
                {/* Header with Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                        <Tab label="Case Notes" />
                        <Tab 
                            label={
                                <Badge badgeContent={followUps.length} color="error">
                                    Follow-ups
                                </Badge>
                            } 
                        />
                    </Tabs>
                </Box>

                <TabPanel value={activeTab} index={0}>
                    {/* Filters and Actions */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                placeholder="Search notes..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                InputProps={{
                                    startAdornment: <SearchIcon />
                                }}
                            />
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Category</InputLabel>
                                <Select
                                    value={filters.category}
                                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                                >
                                    <MenuItem value="">All</MenuItem>
                                    {categories.map(cat => (
                                        <MenuItem key={cat} value={cat}>
                                            {cat.replace('_', ' ').toUpperCase()}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    value={filters.priority}
                                    onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                                >
                                    <MenuItem value="">All</MenuItem>
                                    {priorities.map(priority => (
                                        <MenuItem key={priority} value={priority}>
                                            {priority.toUpperCase()}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>User</InputLabel>
                                <Select
                                    value={filters.user_id}
                                    onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                                >
                                    <MenuItem value="">All</MenuItem>
                                    {users.map(user => (
                                        <MenuItem key={user.id} value={user.id}>
                                            {user.first_name} {user.last_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setOpenDialog(true)}
                            >
                                Add Note
                            </Button>
                        </Grid>
                    </Grid>

                    {/* Notes List */}
                    <Box>
                        {filteredNotes.map((note) => (
                            <Card key={note.id} sx={{ mb: 2 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <Typography variant="h6">{note.title}</Typography>
                                                {getPriorityIcon(note.priority_level)}
                                                <Chip
                                                    size="small"
                                                    label={note.priority_level}
                                                    color={getPriorityColor(note.priority_level)}
                                                />
                                                {note.note_category && (
                                                    <Chip
                                                        size="small"
                                                        label={note.note_category.replace('_', ' ')}
                                                        variant="outlined"
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                By {note.first_name} {note.last_name} • {dayjs(note.created_at).format('MMM DD, YYYY HH:mm')}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleGenerateCoA(note)}
                                                title="Generate Confirmation of Advice"
                                            >
                                                <CoaIcon />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setSelectedNote(note);
                                                    setTranslatedContent(note.content);
                                                    setOpenTranslateDialog(true);
                                                }}
                                                title="Translate Note"
                                            >
                                                <TranslateIcon />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setSelectedNote(note);
                                                    setOpenFollowUpDialog(true);
                                                }}
                                                title="Schedule Follow-up"
                                            >
                                                <ScheduleIcon />
                                            </IconButton>
                                        </Box>
                                    </Box>

                                    <Typography variant="body1" sx={{ mb: 2 }}>
                                        {note.content}
                                    </Typography>

                                    {/* Tags */}
                                    {note.tags && note.tags.length > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                            {note.tags.map((tag, index) => (
                                                <Chip key={index} label={tag} size="small" sx={{ mr: 1, mb: 1 }} />
                                            ))}
                                        </Box>
                                    )}

                                    {/* Attachments */}
                                    {note.attachment_names && note.attachment_names.length > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                Attachments:
                                            </Typography>
                                            {note.attachment_names.map((filename, index) => (
                                                <Chip
                                                    key={index}
                                                    icon={<AttachFileIcon />}
                                                    label={filename}
                                                    size="small"
                                                    sx={{ mr: 1 }}
                                                />
                                            ))}
                                        </Box>
                                    )}

                                    {/* Follow-up Date */}
                                    {note.follow_up_date && (
                                        <Alert severity="info" sx={{ mb: 2 }}>
                                            Follow-up scheduled for: {dayjs(note.follow_up_date).format('MMM DD, YYYY HH:mm')}
                                        </Alert>
                                    )}

                                    {/* Follow-up Actions */}
                                    {note.follow_ups && note.follow_ups.length > 0 && (
                                        <Accordion>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography variant="body2">
                                                    Follow-up Actions ({note.follow_ups.length})
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <List dense>
                                                    {note.follow_ups.map((followUp) => (
                                                        <ListItem key={followUp.id}>
                                                            <ListItemText
                                                                primary={followUp.action_required}
                                                                secondary={`Assigned to: ${followUp.first_name} ${followUp.last_name} • Due: ${followUp.due_date ? dayjs(followUp.due_date).format('MMM DD, YYYY') : 'No due date'}`}
                                                            />
                                                            <ListItemSecondaryAction>
                                                                <Chip
                                                                    size="small"
                                                                    label={followUp.status}
                                                                    color={followUp.status === 'completed' ? 'success' : 'default'}
                                                                />
                                                            </ListItemSecondaryAction>
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </AccordionDetails>
                                        </Accordion>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                </TabPanel>

                <TabPanel value={activeTab} index={1}>
                    {/* Follow-ups Tab */}
                    <Typography variant="h6" sx={{ mb: 2 }}>Pending Follow-up Actions</Typography>
                    {followUps.map((followUp) => (
                        <Card key={followUp.id} sx={{ mb: 2 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" sx={{ mb: 1 }}>
                                            {followUp.action_required}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            Case: {followUp.client_first_name} {followUp.client_last_name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Due: {followUp.due_date ? dayjs(followUp.due_date).format('MMM DD, YYYY') : 'No due date'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Button
                                            size="small"
                                            startIcon={<CheckCircleIcon />}
                                            onClick={() => handleUpdateFollowUp(followUp.id, 'completed')}
                                        >
                                            Complete
                                        </Button>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                </TabPanel>

                {/* Create Note Dialog */}
                <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Create Enhanced Note</DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Title"
                                    value={noteForm.title}
                                    onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Category</InputLabel>
                                    <Select
                                        value={noteForm.note_category}
                                        onChange={(e) => {
                                            setNoteForm({ ...noteForm, note_category: e.target.value });
                                            fetchTemplates(e.target.value);
                                        }}
                                    >
                                        {categories.map(cat => (
                                            <MenuItem key={cat} value={cat}>
                                                {cat.replace('_', ' ').toUpperCase()}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                        value={noteForm.priority_level}
                                        onChange={(e) => setNoteForm({ ...noteForm, priority_level: e.target.value })}
                                    >
                                        {priorities.map(priority => (
                                            <MenuItem key={priority} value={priority}>
                                                {priority.toUpperCase()}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    label="Content"
                                    value={noteForm.content}
                                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    options={[]}
                                    value={noteForm.tags}
                                    onChange={(e, newValue) => setNoteForm({ ...noteForm, tags: newValue })}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Tags" placeholder="Add tags..." />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <DateTimePicker
                                    label="Follow-up Date (Optional)"
                                    value={noteForm.follow_up_date}
                                    onChange={(newValue) => setNoteForm({ ...noteForm, follow_up_date: newValue })}
                                    renderInput={(params) => <TextField {...params} fullWidth />}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreateNote} variant="contained">Create Note</Button>
                    </DialogActions>
                </Dialog>

                {/* Follow-up Dialog */}
                <Dialog open={openFollowUpDialog} onClose={() => setOpenFollowUpDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Schedule Follow-up Action</DialogTitle>
                    <DialogContent>
                        <FollowUpForm
                            users={users}
                            onSubmit={handleCreateFollowUp}
                            onCancel={() => setOpenFollowUpDialog(false)}
                        />
                    </DialogContent>
                </Dialog>

                {/* Confirmation of Advice Dialog */}
                <Dialog open={openCoaDialog} onClose={() => setOpenCoaDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>
                        Confirmation of Advice - {selectedNote?.title}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ mt: 2 }}>
                            {coaLoading ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography>Generating Confirmation of Advice using AI...</Typography>
                                </Box>
                            ) : (
                                <>
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        This Confirmation of Advice was automatically generated from case notes using local AI. 
                                        Please review and modify as needed before sharing with the client.
                                    </Alert>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={15}
                                        label="Confirmation of Advice"
                                        value={coaContent}
                                        onChange={(e) => setCoaContent(e.target.value)}
                                    />
                                </>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button 
                            onClick={() => copyToClipboard(coaContent)}
                            startIcon={<CopyIcon />}
                            disabled={!coaContent}
                        >
                            Copy
                        </Button>
                        <Button 
                            onClick={() => {
                                setSelectedNote({...selectedNote, content: coaContent});
                                setOpenTranslateDialog(true);
                            }}
                            startIcon={<TranslateIcon />}
                            disabled={!coaContent}
                        >
                            Translate
                        </Button>
                        <Button onClick={() => setOpenCoaDialog(false)}>Close</Button>
                    </DialogActions>
                </Dialog>

                {/* Translation Dialog */}
                <Dialog open={openTranslateDialog} onClose={() => setOpenTranslateDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>
                        Translate Content
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ mt: 2 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth sx={{ mb: 2 }}>
                                        <InputLabel>Target Language</InputLabel>
                                        <Select
                                            value={selectedLanguage}
                                            onChange={(e) => {
                                                setSelectedLanguage(e.target.value);
                                                const content = selectedNote?.content || coaContent;
                                                if (content) {
                                                    handleTranslateContent(content, e.target.value);
                                                }
                                            }}
                                        >
                                            {languages.map(lang => (
                                                <MenuItem key={lang.code} value={lang.code}>
                                                    {lang.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ mb: 1 }}>Original (English):</Typography>
                                    <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {selectedNote?.content || coaContent}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ mb: 1 }}>
                                        Translated ({languages.find(l => l.code === selectedLanguage)?.name}):
                                    </Typography>
                                    {translateLoading ? (
                                        <Box sx={{ textAlign: 'center', py: 2 }}>
                                            <Typography>Translating...</Typography>
                                        </Box>
                                    ) : (
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={10}
                                            value={translatedContent}
                                            onChange={(e) => setTranslatedContent(e.target.value)}
                                        />
                                    )}
                                </Grid>
                            </Grid>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button 
                            onClick={() => copyToClipboard(translatedContent)}
                            startIcon={<CopyIcon />}
                            disabled={!translatedContent}
                        >
                            Copy Translation
                        </Button>
                        <Button onClick={() => setOpenTranslateDialog(false)}>Close</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </LocalizationProvider>
    );
};

// Follow-up Form Component
const FollowUpForm = ({ users, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        assigned_to: '',
        action_required: '',
        due_date: null
    });

    const handleSubmit = () => {
        onSubmit(formData);
        setFormData({ assigned_to: '', action_required: '', due_date: null });
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
                <Grid item xs={12}>
                    <FormControl fullWidth>
                        <InputLabel>Assign To</InputLabel>
                        <Select
                            value={formData.assigned_to}
                            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                        >
                            {users.map(user => (
                                <MenuItem key={user.id} value={user.id}>
                                    {user.first_name} {user.last_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Action Required"
                        value={formData.action_required}
                        onChange={(e) => setFormData({ ...formData, action_required: e.target.value })}
                    />
                </Grid>
                <Grid item xs={12}>
                    <DateTimePicker
                        label="Due Date"
                        value={formData.due_date}
                        onChange={(newValue) => setFormData({ ...formData, due_date: newValue })}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained">Schedule</Button>
            </Box>
        </Box>
    );
};

export default EnhancedNotes;

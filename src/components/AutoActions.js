import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Card,
    CardContent,
    IconButton,
    Chip,
    Switch,
    FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Alert
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    PlayArrow as PlayIcon,
    History as HistoryIcon
} from '@mui/icons-material';
import axios from 'axios';

const AutoActions = () => {
    const [rules, setRules] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [logsDialogOpen, setLogsDialogOpen] = useState(false);
    const [newRule, setNewRule] = useState({
        name: '',
        description: '',
        trigger_event: '',
        trigger_conditions: {},
        actions: [],
        priority: 1
    });

    const triggerEvents = [
        { value: 'case_created', label: 'Case Created' },
        { value: 'case_closed', label: 'Case Closed' },
        { value: 'note_added', label: 'Note Added' },
        { value: 'appointment_scheduled', label: 'Appointment Scheduled' },
        { value: 'appointment_missed', label: 'Appointment Missed' },
        { value: 'debt_threshold_exceeded', label: 'Debt Threshold Exceeded' },
        { value: 'vulnerability_identified', label: 'Vulnerability Identified' }
    ];

    const actionTypes = [
        { value: 'send_sms', label: 'Send SMS' },
        { value: 'send_email', label: 'Send Email' },
        { value: 'create_note', label: 'Create Note' },
        { value: 'create_task', label: 'Create Task' },
        { value: 'update_case_status', label: 'Update Case Status' },
        { value: 'notify_supervisor', label: 'Notify Supervisor' },
        { value: 'schedule_appointment', label: 'Schedule Appointment' }
    ];

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/auto-actions/rules', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRules(response.data.rules);
        } catch (error) {
            console.error('Error fetching auto action rules:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/auto-actions/logs', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(response.data.logs);
            setLogsDialogOpen(true);
        } catch (error) {
            console.error('Error fetching auto action logs:', error);
        }
    };

    const handleCreateRule = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/auto-actions/rules', newRule, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCreateDialogOpen(false);
            setNewRule({
                name: '',
                description: '',
                trigger_event: '',
                trigger_conditions: {},
                actions: [],
                priority: 1
            });
            fetchRules();
        } catch (error) {
            console.error('Error creating auto action rule:', error);
        }
    };

    const addAction = () => {
        setNewRule({
            ...newRule,
            actions: [...newRule.actions, { type: '', message: '', subject: '' }]
        });
    };

    const updateAction = (index, field, value) => {
        const updatedActions = [...newRule.actions];
        updatedActions[index][field] = value;
        setNewRule({ ...newRule, actions: updatedActions });
    };

    const removeAction = (index) => {
        const updatedActions = newRule.actions.filter((_, i) => i !== index);
        setNewRule({ ...newRule, actions: updatedActions });
    };

    const renderActionForm = (action, index) => (
        <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                            <InputLabel>Action Type</InputLabel>
                            <Select
                                value={action.type}
                                onChange={(e) => updateAction(index, 'type', e.target.value)}
                                label="Action Type"
                            >
                                {actionTypes.map((type) => (
                                    <MenuItem key={type.value} value={type.value}>
                                        {type.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={8}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                fullWidth
                                label={action.type === 'send_email' ? 'Subject' : 'Message'}
                                value={action.type === 'send_email' ? action.subject : action.message}
                                onChange={(e) => updateAction(
                                    index, 
                                    action.type === 'send_email' ? 'subject' : 'message', 
                                    e.target.value
                                )}
                                placeholder="Use {caseId}, {clientId}, {date}, {time} for dynamic values"
                            />
                            <IconButton onClick={() => removeAction(index)} color="error">
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    </Grid>
                    {action.type === 'send_email' && (
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Email Message"
                                value={action.message}
                                onChange={(e) => updateAction(index, 'message', e.target.value)}
                                placeholder="Email body content..."
                            />
                        </Grid>
                    )}
                </Grid>
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Auto Actions</Typography>
                <Box>
                    <Button
                        variant="outlined"
                        startIcon={<HistoryIcon />}
                        onClick={fetchLogs}
                        sx={{ mr: 2 }}
                    >
                        View Logs
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        Create Rule
                    </Button>
                </Box>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
                Auto Actions automatically perform tasks when specific events occur in your cases. 
                Rules are executed in priority order when their conditions are met.
            </Alert>

            {/* Rules List */}
            <Box>
                {rules.map((rule) => (
                    <Accordion key={rule.id} sx={{ mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                    {rule.name}
                                </Typography>
                                <Chip
                                    label={`Priority: ${rule.priority}`}
                                    size="small"
                                    sx={{ mr: 2 }}
                                />
                                <Chip
                                    label={rule.trigger_event.replace('_', ' ')}
                                    color="primary"
                                    size="small"
                                    sx={{ mr: 2 }}
                                />
                                <Switch
                                    checked={rule.is_active}
                                    size="small"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Typography variant="body2" color="textSecondary">
                                        {rule.description}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2">Trigger Event:</Typography>
                                    <Typography>{rule.trigger_event.replace('_', ' ')}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2">Actions:</Typography>
                                    <Typography>{rule.actions.length} action(s) configured</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2">Conditions:</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                        {JSON.stringify(rule.trigger_conditions, null, 2)}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Box>

            {/* Create Rule Dialog */}
            <Dialog 
                open={createDialogOpen} 
                onClose={() => setCreateDialogOpen(false)} 
                maxWidth="md" 
                fullWidth
            >
                <DialogTitle>Create Auto Action Rule</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Rule Name"
                                value={newRule.name}
                                onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={2}
                                label="Description"
                                value={newRule.description}
                                onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Trigger Event</InputLabel>
                                <Select
                                    value={newRule.trigger_event}
                                    onChange={(e) => setNewRule({...newRule, trigger_event: e.target.value})}
                                    label="Trigger Event"
                                >
                                    {triggerEvents.map((event) => (
                                        <MenuItem key={event.value} value={event.value}>
                                            {event.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Priority"
                                value={newRule.priority}
                                onChange={(e) => setNewRule({...newRule, priority: parseInt(e.target.value)})}
                                inputProps={{ min: 1, max: 10 }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ mb: 2 }}>Actions</Typography>
                            {newRule.actions.map((action, index) => renderActionForm(action, index))}
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={addAction}
                                fullWidth
                            >
                                Add Action
                            </Button>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={handleCreateRule} 
                        variant="contained"
                        disabled={!newRule.name || !newRule.trigger_event || newRule.actions.length === 0}
                    >
                        Create Rule
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Logs Dialog */}
            <Dialog open={logsDialogOpen} onClose={() => setLogsDialogOpen(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Auto Action Execution Logs</DialogTitle>
                <DialogContent>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Rule</TableCell>
                                    <TableCell>Case</TableCell>
                                    <TableCell>Client</TableCell>
                                    <TableCell>Executed</TableCell>
                                    <TableCell>Results</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{log.rule_name}</TableCell>
                                        <TableCell>{log.case_number}</TableCell>
                                        <TableCell>{log.client_name}</TableCell>
                                        <TableCell>
                                            {new Date(log.executed_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                {JSON.stringify(log.execution_results, null, 2)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogsDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AutoActions;

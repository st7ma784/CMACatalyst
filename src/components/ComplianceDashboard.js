import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    LinearProgress,
    Chip,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Schedule as ScheduleIcon,
    Assignment as AssignmentIcon,
    ExpandMore as ExpandMoreIcon,
    Visibility as VisibilityIcon,
    Edit as EditIcon,
    History as HistoryIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';

const ComplianceDashboard = ({ caseId = null }) => {
    const [dashboardData, setDashboardData] = useState(null);
    const [caseCompliance, setCaseCompliance] = useState([]);
    const [auditTrail, setAuditTrail] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(caseId ? 1 : 0);
    const [openChecklistDialog, setOpenChecklistDialog] = useState(false);
    const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
    const [openAuditDialog, setOpenAuditDialog] = useState(false);
    const [selectedChecklist, setSelectedChecklist] = useState(null);

    useEffect(() => {
        if (!caseId) {
            fetchDashboardData();
        } else {
            fetchCaseCompliance();
        }
    }, [caseId]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/compliance/dashboard');
            setDashboardData(response.data);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCaseCompliance = async () => {
        if (!caseId) return;
        setLoading(true);
        try {
            const response = await axios.get(`/api/compliance/case/${caseId}`);
            setCaseCompliance(response.data);
        } catch (error) {
            console.error('Error fetching case compliance:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditTrail = async () => {
        if (!caseId) return;
        try {
            const response = await axios.get(`/api/compliance/case/${caseId}/audit-trail`);
            setAuditTrail(response.data);
        } catch (error) {
            console.error('Error fetching audit trail:', error);
        }
    };

    const handleUpdateCompliance = async (checklistId, completedItems, notes) => {
        try {
            await axios.put(`/api/compliance/case/${caseId}/checklist/${checklistId}`, {
                completed_items: completedItems,
                notes
            });
            fetchCaseCompliance();
            setOpenChecklistDialog(false);
        } catch (error) {
            console.error('Error updating compliance:', error);
        }
    };

    const handleScheduleReview = async (reviewData) => {
        try {
            await axios.post(`/api/compliance/case/${caseId}/schedule-review`, reviewData);
            setOpenScheduleDialog(false);
        } catch (error) {
            console.error('Error scheduling review:', error);
        }
    };

    const getComplianceStatusColor = (status) => {
        switch (status) {
            case 'compliant': return 'success';
            case 'non_compliant': return 'error';
            case 'requires_review': return 'warning';
            case 'in_progress': return 'info';
            default: return 'default';
        }
    };

    const getComplianceStatusIcon = (status) => {
        switch (status) {
            case 'compliant': return <CheckCircleIcon color="success" />;
            case 'non_compliant': return <WarningIcon color="error" />;
            case 'requires_review': return <WarningIcon color="warning" />;
            default: return <ScheduleIcon color="disabled" />;
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
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                        {!caseId && <Tab label="Dashboard Overview" />}
                        <Tab label={caseId ? "Case Compliance" : "Case Reviews"} />
                        {caseId && <Tab label="Audit Trail" />}
                    </Tabs>
                </Box>

                {/* Dashboard Overview Tab */}
                {!caseId && (
                    <TabPanel value={activeTab} index={0}>
                        {dashboardData && (
                            <Grid container spacing={3}>
                                {/* Overall Statistics */}
                                <Grid item xs={12}>
                                    <Typography variant="h5" sx={{ mb: 2 }}>Compliance Overview</Typography>
                                </Grid>
                                
                                <Grid item xs={12} md={3}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h4" color="primary">
                                                {dashboardData.overall.total_cases_reviewed || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Cases Reviewed
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h4" color="success.main">
                                                {Math.round(dashboardData.overall.avg_completion_percentage || 0)}%
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Average Completion
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h4" color="success.main">
                                                {dashboardData.overall.compliant_cases || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Compliant Cases
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12} md={3}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h4" color="warning.main">
                                                {dashboardData.overall.requires_review_cases || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Require Review
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Cases Requiring Attention */}
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ mb: 2 }}>
                                                Cases Requiring Attention
                                            </Typography>
                                            <List>
                                                {dashboardData.attention_required.slice(0, 5).map((caseItem) => (
                                                    <ListItem key={caseItem.case_id}>
                                                        <ListItemText
                                                            primary={caseItem.client_name}
                                                            secondary={`Last reviewed: ${caseItem.last_reviewed_at ? dayjs(caseItem.last_reviewed_at).format('MMM DD, YYYY') : 'Never'}`}
                                                        />
                                                        <ListItemSecondaryAction>
                                                            <Chip
                                                                size="small"
                                                                label={caseItem.compliance_status || 'Pending'}
                                                                color={getComplianceStatusColor(caseItem.compliance_status)}
                                                            />
                                                        </ListItemSecondaryAction>
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Compliance by Checklist */}
                                <Grid item xs={12} md={6}>
                                    <Card>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ mb: 2 }}>
                                                Compliance by Checklist
                                            </Typography>
                                            <List>
                                                {dashboardData.by_checklist.slice(0, 5).map((checklist, index) => (
                                                    <ListItem key={index}>
                                                        <ListItemText
                                                            primary={checklist.checklist_name}
                                                            secondary={`${checklist.framework_name} • ${checklist.total_reviews} reviews`}
                                                        />
                                                        <ListItemSecondaryAction>
                                                            <Box sx={{ minWidth: 100 }}>
                                                                <LinearProgress
                                                                    variant="determinate"
                                                                    value={checklist.avg_completion || 0}
                                                                    sx={{ mb: 1 }}
                                                                />
                                                                <Typography variant="caption">
                                                                    {Math.round(checklist.avg_completion || 0)}%
                                                                </Typography>
                                                            </Box>
                                                        </ListItemSecondaryAction>
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        )}
                    </TabPanel>
                )}

                {/* Case Compliance Tab */}
                <TabPanel value={activeTab} index={caseId ? 0 : 1}>
                    {caseId ? (
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h5">Case Compliance Checklists</Typography>
                                <Button
                                    variant="outlined"
                                    startIcon={<ScheduleIcon />}
                                    onClick={() => setOpenScheduleDialog(true)}
                                >
                                    Schedule Review
                                </Button>
                            </Box>

                            {caseCompliance.map((item) => (
                                <Card key={item.id} sx={{ mb: 2 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="h6" sx={{ mb: 1 }}>
                                                    {item.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                    {item.framework_name} v{item.framework_version}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mb: 2 }}>
                                                    {item.description}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {getComplianceStatusIcon(item.compliance.compliance_status)}
                                                <Chip
                                                    label={item.compliance.compliance_status || 'Pending'}
                                                    color={getComplianceStatusColor(item.compliance.compliance_status)}
                                                    size="small"
                                                />
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="body2">
                                                    Completion Progress
                                                </Typography>
                                                <Typography variant="body2">
                                                    {Math.round(item.compliance.completion_percentage || 0)}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={item.compliance.completion_percentage || 0}
                                                color={item.compliance.completion_percentage === 100 ? 'success' : 'primary'}
                                            />
                                        </Box>

                                        {item.compliance.last_reviewed_at && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Last reviewed: {dayjs(item.compliance.last_reviewed_at).format('MMM DD, YYYY HH:mm')}
                                                {item.compliance.first_name && ` by ${item.compliance.first_name} ${item.compliance.last_name}`}
                                            </Typography>
                                        )}

                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                startIcon={<EditIcon />}
                                                onClick={() => {
                                                    setSelectedChecklist(item);
                                                    setOpenChecklistDialog(true);
                                                }}
                                            >
                                                Review Checklist
                                            </Button>
                                            <Button
                                                size="small"
                                                startIcon={<VisibilityIcon />}
                                                onClick={() => {
                                                    setSelectedChecklist(item);
                                                    // Show checklist details
                                                }}
                                            >
                                                View Details
                                            </Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    ) : (
                        <Typography>Select a case to view compliance details</Typography>
                    )}
                </TabPanel>

                {/* Audit Trail Tab */}
                {caseId && (
                    <TabPanel value={activeTab} index={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h5">Compliance Audit Trail</Typography>
                            <Button
                                variant="outlined"
                                startIcon={<HistoryIcon />}
                                onClick={() => {
                                    fetchAuditTrail();
                                    setOpenAuditDialog(true);
                                }}
                            >
                                View Full Trail
                            </Button>
                        </Box>

                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date/Time</TableCell>
                                        <TableCell>User</TableCell>
                                        <TableCell>Action</TableCell>
                                        <TableCell>Details</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {auditTrail.slice(0, 10).map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell>
                                                {dayjs(entry.timestamp).format('MMM DD, YYYY HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                {entry.first_name} {entry.last_name}
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" label={entry.action.replace('_', ' ')} />
                                            </TableCell>
                                            <TableCell>
                                                {entry.checklist_item}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </TabPanel>
                )}

                {/* Checklist Review Dialog */}
                <Dialog open={openChecklistDialog} onClose={() => setOpenChecklistDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>
                        Review Compliance Checklist
                        {selectedChecklist && ` - ${selectedChecklist.name}`}
                    </DialogTitle>
                    <DialogContent>
                        {selectedChecklist && (
                            <ChecklistReviewForm
                                checklist={selectedChecklist}
                                onSubmit={handleUpdateCompliance}
                                onCancel={() => setOpenChecklistDialog(false)}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                {/* Schedule Review Dialog */}
                <Dialog open={openScheduleDialog} onClose={() => setOpenScheduleDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Schedule Compliance Review</DialogTitle>
                    <DialogContent>
                        <ScheduleReviewForm
                            onSubmit={handleScheduleReview}
                            onCancel={() => setOpenScheduleDialog(false)}
                        />
                    </DialogContent>
                </Dialog>
            </Box>
        </LocalizationProvider>
    );
};

// Checklist Review Form Component
const ChecklistReviewForm = ({ checklist, onSubmit, onCancel }) => {
    const [completedItems, setCompletedItems] = useState(checklist.compliance.completed_items || []);
    const [notes, setNotes] = useState(checklist.compliance.notes || '');

    const handleItemToggle = (itemId) => {
        setCompletedItems(prev => 
            prev.includes(itemId) 
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const handleSubmit = () => {
        onSubmit(checklist.id, completedItems, notes);
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {checklist.description}
            </Typography>

            <Typography variant="h6" sx={{ mb: 2 }}>Checklist Items</Typography>
            
            <FormGroup>
                {checklist.checklist_items && checklist.checklist_items.map((item, index) => (
                    <FormControlLabel
                        key={index}
                        control={
                            <Checkbox
                                checked={completedItems.includes(index)}
                                onChange={() => handleItemToggle(index)}
                            />
                        }
                        label={typeof item === 'string' ? item : item.description || item.title}
                    />
                ))}
            </FormGroup>

            <TextField
                fullWidth
                multiline
                rows={4}
                label="Review Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                sx={{ mt: 3, mb: 2 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained">Save Review</Button>
            </Box>
        </Box>
    );
};

// Schedule Review Form Component
const ScheduleReviewForm = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        due_date: dayjs().add(1, 'week'),
        review_type: 'periodic_review',
        notes: ''
    });

    const handleSubmit = () => {
        onSubmit(formData);
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
                <Grid item xs={12}>
                    <FormControl fullWidth>
                        <InputLabel>Review Type</InputLabel>
                        <Select
                            value={formData.review_type}
                            onChange={(e) => setFormData({ ...formData, review_type: e.target.value })}
                        >
                            <MenuItem value="periodic_review">Periodic Review</MenuItem>
                            <MenuItem value="case_closure">Case Closure Review</MenuItem>
                            <MenuItem value="compliance_audit">Compliance Audit</MenuItem>
                            <MenuItem value="regulatory_check">Regulatory Check</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <DateTimePicker
                        label="Due Date"
                        value={formData.due_date}
                        onChange={(newValue) => setFormData({ ...formData, due_date: newValue })}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

export default ComplianceDashboard;

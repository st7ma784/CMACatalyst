import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    LinearProgress,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    FormControlLabel,
    Checkbox,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Download as DownloadIcon,
    Visibility as VisibilityIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    ExpandMore as ExpandMoreIcon,
    Assessment as AssessmentIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import axios from 'axios';

const CreditReports = ({ caseId, clientData }) => {
    const [reports, setReports] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openRequestDialog, setOpenRequestDialog] = useState(false);
    const [openReportDialog, setOpenReportDialog] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);

    const [requestForm, setRequestForm] = useState({
        bureau: '',
        request_type: 'full',
        consent_given: false,
        client_details: {
            first_name: clientData?.first_name || '',
            last_name: clientData?.last_name || '',
            date_of_birth: clientData?.date_of_birth || '',
            address: clientData?.address || '',
            postcode: clientData?.postcode || ''
        }
    });

    const creditBureaus = [
        { value: 'experian', label: 'Experian', cost: '£5.00' },
        { value: 'equifax', label: 'Equifax', cost: '£4.50' },
        { value: 'transunion', label: 'TransUnion', cost: '£4.75' }
    ];

    const requestTypes = [
        { value: 'full', label: 'Full Credit Report' },
        { value: 'summary', label: 'Credit Summary' },
        { value: 'monitoring', label: 'Credit Monitoring Setup' }
    ];

    useEffect(() => {
        if (caseId) {
            fetchReports();
            fetchAlerts();
        }
    }, [caseId]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/credit-reports/case/${caseId}`);
            setReports(response.data);
        } catch (error) {
            console.error('Error fetching credit reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAlerts = async () => {
        try {
            const response = await axios.get('/api/credit-reports/alerts');
            setAlerts(response.data);
        } catch (error) {
            console.error('Error fetching credit alerts:', error);
        }
    };

    const handleRequestReport = async () => {
        try {
            setLoading(true);
            await axios.post('/api/credit-reports/request', {
                case_id: caseId,
                client_id: clientData?.id,
                ...requestForm
            });
            
            setOpenRequestDialog(false);
            fetchReports();
            resetRequestForm();
        } catch (error) {
            console.error('Error requesting credit report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewReport = async (requestId) => {
        try {
            const response = await axios.get(`/api/credit-reports/report/${requestId}`);
            setSelectedReport(response.data);
            setOpenReportDialog(true);
        } catch (error) {
            console.error('Error fetching report details:', error);
        }
    };

    const handleDownloadReport = async (requestId) => {
        try {
            const response = await axios.get(`/api/credit-reports/report/${requestId}/download`, {
                responseType: 'blob'
            });
            
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `credit_report_${requestId}.pdf`;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading report:', error);
        }
    };

    const handleResolveAlert = async (alertId) => {
        try {
            await axios.put(`/api/credit-reports/alerts/${alertId}/resolve`);
            fetchAlerts();
        } catch (error) {
            console.error('Error resolving alert:', error);
        }
    };

    const resetRequestForm = () => {
        setRequestForm({
            bureau: '',
            request_type: 'full',
            consent_given: false,
            client_details: {
                first_name: clientData?.first_name || '',
                last_name: clientData?.last_name || '',
                date_of_birth: clientData?.date_of_birth || '',
                address: clientData?.address || '',
                postcode: clientData?.postcode || ''
            }
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'success';
            case 'processing': return 'info';
            case 'failed': return 'error';
            default: return 'warning';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircleIcon color="success" />;
            case 'processing': return <ScheduleIcon color="info" />;
            case 'failed': return <WarningIcon color="error" />;
            default: return <ScheduleIcon color="warning" />;
        }
    };

    const getCreditScoreColor = (score) => {
        if (score >= 700) return 'success';
        if (score >= 500) return 'warning';
        return 'error';
    };

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">Credit Reports</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenRequestDialog(true)}
                    disabled={!clientData}
                >
                    Request Credit Report
                </Button>
            </Box>

            {/* Credit Alerts */}
            {alerts.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Credit Monitoring Alerts
                        </Typography>
                        <List>
                            {alerts.slice(0, 3).map((alert) => (
                                <ListItem key={alert.id}>
                                    <ListItemText
                                        primary={alert.alert_type.replace('_', ' ').toUpperCase()}
                                        secondary={`${alert.first_name} ${alert.last_name} • ${alert.description}`}
                                    />
                                    <ListItemSecondaryAction>
                                        <Chip
                                            size="small"
                                            label={alert.severity}
                                            color={alert.severity === 'high' ? 'error' : 'warning'}
                                            sx={{ mr: 1 }}
                                        />
                                        <Button
                                            size="small"
                                            onClick={() => handleResolveAlert(alert.id)}
                                        >
                                            Resolve
                                        </Button>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            )}

            {/* Reports List */}
            <Grid container spacing={3}>
                {reports.map((report) => (
                    <Grid item xs={12} md={6} key={report.id}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6">
                                            {creditBureaus.find(b => b.value === report.bureau)?.label || report.bureau}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {report.request_type.replace('_', ' ').toUpperCase()}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getStatusIcon(report.status)}
                                        <Chip
                                            size="small"
                                            label={report.status}
                                            color={getStatusColor(report.status)}
                                        />
                                    </Box>
                                </Box>

                                {report.credit_score && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Credit Score
                                        </Typography>
                                        <Typography 
                                            variant="h4" 
                                            color={`${getCreditScoreColor(report.credit_score)}.main`}
                                        >
                                            {report.credit_score}
                                        </Typography>
                                        {report.risk_grade && (
                                            <Chip
                                                size="small"
                                                label={`Grade ${report.risk_grade}`}
                                                color={getCreditScoreColor(report.credit_score)}
                                                variant="outlined"
                                            />
                                        )}
                                    </Box>
                                )}

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Requested: {dayjs(report.requested_at).format('MMM DD, YYYY HH:mm')}
                                    <br />
                                    By: {report.first_name} {report.last_name}
                                    {report.completed_at && (
                                        <>
                                            <br />
                                            Completed: {dayjs(report.completed_at).format('MMM DD, YYYY HH:mm')}
                                        </>
                                    )}
                                </Typography>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {report.status === 'completed' && (
                                        <>
                                            <Button
                                                size="small"
                                                startIcon={<VisibilityIcon />}
                                                onClick={() => handleViewReport(report.id)}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="small"
                                                startIcon={<DownloadIcon />}
                                                onClick={() => handleDownloadReport(report.id)}
                                            >
                                                Download
                                            </Button>
                                        </>
                                    )}
                                    {report.status === 'processing' && (
                                        <LinearProgress sx={{ width: '100%' }} />
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {reports.length === 0 && !loading && (
                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <AssessmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                            No Credit Reports
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Request a credit report to get started with credit analysis.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* Request Credit Report Dialog */}
            <Dialog open={openRequestDialog} onClose={() => setOpenRequestDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Request Credit Report</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Credit Bureau</InputLabel>
                                <Select
                                    value={requestForm.bureau}
                                    onChange={(e) => setRequestForm({ ...requestForm, bureau: e.target.value })}
                                >
                                    {creditBureaus.map(bureau => (
                                        <MenuItem key={bureau.value} value={bureau.value}>
                                            {bureau.label} ({bureau.cost})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Report Type</InputLabel>
                                <Select
                                    value={requestForm.request_type}
                                    onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })}
                                >
                                    {requestTypes.map(type => (
                                        <MenuItem key={type.value} value={type.value}>
                                            {type.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid item xs={12}>
                            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                                Client Details
                            </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="First Name"
                                value={requestForm.client_details.first_name}
                                onChange={(e) => setRequestForm({
                                    ...requestForm,
                                    client_details: { ...requestForm.client_details, first_name: e.target.value }
                                })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Last Name"
                                value={requestForm.client_details.last_name}
                                onChange={(e) => setRequestForm({
                                    ...requestForm,
                                    client_details: { ...requestForm.client_details, last_name: e.target.value }
                                })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Date of Birth"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={requestForm.client_details.date_of_birth}
                                onChange={(e) => setRequestForm({
                                    ...requestForm,
                                    client_details: { ...requestForm.client_details, date_of_birth: e.target.value }
                                })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                label="Postcode"
                                value={requestForm.client_details.postcode}
                                onChange={(e) => setRequestForm({
                                    ...requestForm,
                                    client_details: { ...requestForm.client_details, postcode: e.target.value }
                                })}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Address"
                                multiline
                                rows={2}
                                value={requestForm.client_details.address}
                                onChange={(e) => setRequestForm({
                                    ...requestForm,
                                    client_details: { ...requestForm.client_details, address: e.target.value }
                                })}
                            />
                        </Grid>
                        
                        <Grid item xs={12}>
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                    <strong>Important:</strong> Client consent is required before requesting a credit report. 
                                    This will result in a search being recorded on the client's credit file.
                                </Typography>
                            </Alert>
                            
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={requestForm.consent_given}
                                        onChange={(e) => setRequestForm({ ...requestForm, consent_given: e.target.checked })}
                                    />
                                }
                                label="I confirm that the client has given explicit consent for this credit report request"
                                sx={{ mt: 2 }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenRequestDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleRequestReport} 
                        variant="contained"
                        disabled={!requestForm.bureau || !requestForm.consent_given || loading}
                    >
                        Request Report
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Credit Report Details Dialog */}
            <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Credit Report Details</DialogTitle>
                <DialogContent>
                    {selectedReport && (
                        <Box>
                            {/* Summary */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2 }}>Summary</Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={3}>
                                            <Typography variant="body2" color="text.secondary">Credit Score</Typography>
                                            <Typography variant="h4" color={`${getCreditScoreColor(selectedReport.credit_score)}.main`}>
                                                {selectedReport.credit_score}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Typography variant="body2" color="text.secondary">Risk Grade</Typography>
                                            <Typography variant="h4">{selectedReport.risk_grade}</Typography>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Typography variant="body2" color="text.secondary">Total Accounts</Typography>
                                            <Typography variant="h4">{selectedReport.summary?.total_accounts || 0}</Typography>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Typography variant="body2" color="text.secondary">Total Balance</Typography>
                                            <Typography variant="h4">£{selectedReport.summary?.total_balance || 0}</Typography>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>

                            {/* Accounts */}
                            <Accordion defaultExpanded>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="h6">Credit Accounts</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <TableContainer component={Paper}>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Creditor</TableCell>
                                                    <TableCell>Type</TableCell>
                                                    <TableCell>Balance</TableCell>
                                                    <TableCell>Limit</TableCell>
                                                    <TableCell>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {selectedReport.accounts?.map((account, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{account.creditor}</TableCell>
                                                        <TableCell>{account.account_type}</TableCell>
                                                        <TableCell>£{account.balance}</TableCell>
                                                        <TableCell>£{account.credit_limit || 'N/A'}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                size="small"
                                                                label={account.status}
                                                                color={account.status === 'Active' ? 'success' : 'error'}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </AccordionDetails>
                            </Accordion>

                            {/* Searches */}
                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="h6">Recent Searches</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <List>
                                        {selectedReport.searches?.map((search, index) => (
                                            <ListItem key={index}>
                                                <ListItemText
                                                    primary={search.creditor}
                                                    secondary={`${search.search_type} • ${dayjs(search.date).format('MMM DD, YYYY')}`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenReportDialog(false)}>Close</Button>
                    {selectedReport && (
                        <Button
                            startIcon={<DownloadIcon />}
                            onClick={() => handleDownloadReport(selectedReport.request_id)}
                        >
                            Download PDF
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CreditReports;

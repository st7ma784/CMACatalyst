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
    Chip,
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
    Tooltip,
    Alert
} from '@mui/material';
import {
    Visibility as ViewIcon,
    Assignment as AssignIcon,
    PersonAdd as ConvertIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

const DigitalReferrals = () => {
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReferral, setSelectedReferral] = useState(null);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [convertDialogOpen, setConvertDialogOpen] = useState(false);
    const [advisors, setAdvisors] = useState([]);
    const [selectedAdvisor, setSelectedAdvisor] = useState('');
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [stats, setStats] = useState({});
    const [filters, setFilters] = useState({
        status: '',
        urgency: ''
    });

    useEffect(() => {
        fetchReferrals();
        fetchAdvisors();
        fetchStats();
    }, [filters]);

    const fetchReferrals = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.urgency) params.append('urgency', filters.urgency);

            const response = await axios.get(`/api/digital-referrals?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReferrals(response.data.referrals);
        } catch (error) {
            console.error('Error fetching referrals:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdvisors = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/auth/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAdvisors(response.data.users.filter(user => user.role === 'advisor'));
        } catch (error) {
            console.error('Error fetching advisors:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/digital-referrals/stats/summary', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(response.data.stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleViewReferral = async (referralId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/digital-referrals/${referralId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedReferral(response.data.referral);
            setViewDialogOpen(true);
        } catch (error) {
            console.error('Error fetching referral details:', error);
        }
    };

    const handleAssignReferral = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/digital-referrals/${selectedReferral.id}/assign`, {
                advisorId: selectedAdvisor
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAssignDialogOpen(false);
            setSelectedAdvisor('');
            fetchReferrals();
            fetchStats();
        } catch (error) {
            console.error('Error assigning referral:', error);
        }
    };

    const handleConvertReferral = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(`/api/digital-referrals/${selectedReferral.id}/convert`, {
                additionalInfo
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConvertDialogOpen(false);
            setAdditionalInfo('');
            fetchReferrals();
            fetchStats();
            
            // Show success message with case details
            alert(`Referral converted successfully! Case ID: ${response.data.caseId}`);
        } catch (error) {
            console.error('Error converting referral:', error);
        }
    };

    const getUrgencyColor = (urgency) => {
        switch (urgency) {
            case 'high': return 'error';
            case 'medium': return 'warning';
            case 'low': return 'success';
            default: return 'default';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'warning';
            case 'assigned': return 'info';
            case 'converted': return 'success';
            case 'rejected': return 'error';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Digital Referrals
            </Typography>

            {/* Statistics Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Referrals
                            </Typography>
                            <Typography variant="h4">
                                {stats.total_referrals || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Pending
                            </Typography>
                            <Typography variant="h4" color="warning.main">
                                {stats.pending || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                High Priority
                            </Typography>
                            <Typography variant="h4" color="error.main">
                                {stats.high_priority || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                This Week
                            </Typography>
                            <Typography variant="h4" color="primary.main">
                                {stats.this_week || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}>
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filters.status}
                                onChange={(e) => setFilters({...filters, status: e.target.value})}
                                label="Status"
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="assigned">Assigned</MenuItem>
                                <MenuItem value="converted">Converted</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <FormControl fullWidth>
                            <InputLabel>Urgency</InputLabel>
                            <Select
                                value={filters.urgency}
                                onChange={(e) => setFilters({...filters, urgency: e.target.value})}
                                label="Urgency"
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="high">High</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="low">Low</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={fetchReferrals}
                            fullWidth
                        >
                            Refresh
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Referrals Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Source</TableCell>
                            <TableCell>Urgency</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Submitted</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {referrals.map((referral) => (
                            <TableRow key={referral.id}>
                                <TableCell>
                                    {referral.first_name} {referral.last_name}
                                </TableCell>
                                <TableCell>{referral.email}</TableCell>
                                <TableCell>{referral.referral_source}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={referral.urgency_level}
                                        color={getUrgencyColor(referral.urgency_level)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={referral.status}
                                        color={getStatusColor(referral.status)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    {new Date(referral.submitted_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="View Details">
                                        <IconButton
                                            onClick={() => handleViewReferral(referral.id)}
                                            size="small"
                                        >
                                            <ViewIcon />
                                        </IconButton>
                                    </Tooltip>
                                    {referral.status === 'pending' && (
                                        <Tooltip title="Assign to Advisor">
                                            <IconButton
                                                onClick={() => {
                                                    setSelectedReferral(referral);
                                                    setAssignDialogOpen(true);
                                                }}
                                                size="small"
                                            >
                                                <AssignIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {referral.status === 'assigned' && (
                                        <Tooltip title="Convert to Case">
                                            <IconButton
                                                onClick={() => {
                                                    setSelectedReferral(referral);
                                                    setConvertDialogOpen(true);
                                                }}
                                                size="small"
                                            >
                                                <ConvertIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* View Referral Dialog */}
            <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Referral Details</DialogTitle>
                <DialogContent>
                    {selectedReferral && (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2">Name:</Typography>
                                <Typography>{selectedReferral.first_name} {selectedReferral.last_name}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2">Email:</Typography>
                                <Typography>{selectedReferral.email}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2">Phone:</Typography>
                                <Typography>{selectedReferral.phone || 'Not provided'}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2">Date of Birth:</Typography>
                                <Typography>
                                    {selectedReferral.date_of_birth ? 
                                        new Date(selectedReferral.date_of_birth).toLocaleDateString() : 
                                        'Not provided'
                                    }
                                </Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2">Address:</Typography>
                                <Typography>{selectedReferral.address || 'Not provided'}</Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle2">Problem Description:</Typography>
                                <Typography>{selectedReferral.problem_description}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2">Referral Source:</Typography>
                                <Typography>{selectedReferral.referral_source}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="subtitle2">Preferred Contact:</Typography>
                                <Typography>{selectedReferral.preferred_contact}</Typography>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Assign Referral Dialog */}
            <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)}>
                <DialogTitle>Assign Referral</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Select Advisor</InputLabel>
                        <Select
                            value={selectedAdvisor}
                            onChange={(e) => setSelectedAdvisor(e.target.value)}
                            label="Select Advisor"
                        >
                            {advisors.map((advisor) => (
                                <MenuItem key={advisor.id} value={advisor.id}>
                                    {advisor.first_name} {advisor.last_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={handleAssignReferral} 
                        variant="contained"
                        disabled={!selectedAdvisor}
                    >
                        Assign
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Convert Referral Dialog */}
            <Dialog open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Convert to Case</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        This will create a new client and case record from this referral.
                    </Alert>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Additional Information (Optional)"
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        placeholder="Add any additional notes for the initial assessment..."
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConvertDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={handleConvertReferral} 
                        variant="contained"
                        color="primary"
                    >
                        Convert to Case
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DigitalReferrals;

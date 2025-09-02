import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  People as PeopleIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  ArrowForward as ArrowForwardIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [recentCases, setRecentCases] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [complianceDashboard, setComplianceDashboard] = useState(null);
  const [casesByStatus, setCasesByStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dashboardRes, casesRes] = await Promise.all([
          axios.get('/api/dashboard', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }),
          axios.get('/api/cases?limit=5', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        ]);

        const dashboardData = dashboardRes.data;
        setStats(dashboardData.caseStats);
        setRecentCases(dashboardData.recentCases || []);
        setUpcomingAppointments(dashboardData.upcomingAppointments || []);
        
        // Group cases by status from the actual cases data
        const statusCounts = {};
        const casesData = Array.isArray(casesRes.data) ? casesRes.data : [];
        casesData.forEach(caseItem => {
          const status = caseItem.status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        // Create status data with default options
        const defaultStatuses = [
          { value: 'active', label: 'Active' },
          { value: 'closed', label: 'Closed' },
          { value: 'pending', label: 'Pending' }
        ];
        
        const statusData = defaultStatuses.map(option => ({
          ...option,
          count: statusCounts[option.value] || 0
        }));
        
        setCasesByStatus(statusData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const StatCard = ({ title, value, icon, color, onClick, trend }) => (
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px 0 rgba(0, 0, 0, 0.1)',
        } : {},
      }} 
      onClick={onClick}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
          <Box>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ fontWeight: 500, mb: 1 }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h3" 
              component="h2" 
              sx={{ fontWeight: 700, color: 'text.primary' }}
            >
              {value || 0}
            </Typography>
            {trend && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: trend > 0 ? 'success.main' : 'error.main',
                  fontWeight: 500,
                  mt: 0.5,
                  display: 'block'
                }}
              >
                {trend > 0 ? '+' : ''}{trend}% from last month
              </Typography>
            )}
          </Box>
          <Box 
            sx={{ 
              p: 1.5,
              borderRadius: 2,
              backgroundColor: `${color}15`,
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
        {onClick && (
          <Box display="flex" alignItems="center" sx={{ color: 'primary.main', fontSize: '0.875rem', fontWeight: 500 }}>
            View details
            <ArrowForwardIcon sx={{ ml: 0.5, fontSize: '1rem' }} />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'first_enquiry': 'info',
      'fact_finding': 'primary',
      'assessment_complete': 'secondary',
      'debt_options_presented': 'warning',
      'solution_agreed': 'success',
      'implementation': 'primary',
      'monitoring': 'info',
      'review_due': 'warning',
      'closure_pending': 'secondary',
      'closed': 'success',
      'referred_external': 'default',
      'on_hold': 'default',
      'cancelled': 'error'
    };
    return statusColors[status] || 'default';
  };

  if (loading) {
    return <Typography>Loading dashboard...</Typography>;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 0 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome back, {user?.first_name || 'User'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your cases today
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Cases"
            value={stats?.active_cases || 0}
            icon={<WorkIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/cases')}
            trend={12}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Clients"
            value={stats?.total_clients || 0}
            icon={<PeopleIcon fontSize="large" />}
            color="secondary.main"
            onClick={() => navigate('/clients')}
            trend={8}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Upcoming Appointments"
            value={stats?.upcoming_appointments || 0}
            icon={<ScheduleIcon fontSize="large" />}
            color="success.main"
            onClick={() => navigate('/calendar')}
            trend={-3}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Debt Managed"
            value={formatCurrency(stats?.total_debt_managed || 0)}
            icon={<AssessmentIcon fontSize="large" />}
            color="warning.main"
            trend={15}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Case Status Overview */}
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <AssessmentIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Cases by Status</Typography>
                </Box>
                <List dense>
                  {casesByStatus.filter(status => status.count > 0).map((status) => (
                    <ListItem key={status.value}>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2">{status.label}</Typography>
                            <Chip
                              label={status.count}
                              color={getStatusColor(status.value)}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={status.description}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* FCA Compliance Overview */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <CheckCircleIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">FCA Compliance Overview</Typography>
                </Box>
                {complianceDashboard ? (
                  <Box>
                    <Box mb={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Overall Completion Rate
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={complianceDashboard.overall?.avg_completion_percentage || 0}
                        sx={{ height: 8, borderRadius: 4 }}
                        color={complianceDashboard.overall?.avg_completion_percentage >= 80 ? 'success' : 'warning'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {Math.round(complianceDashboard.overall?.avg_completion_percentage || 0)}% complete
                      </Typography>
                    </Box>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Cases Requiring Attention
                    </Typography>
                    {complianceDashboard.attention_required?.length > 0 ? (
                      <List dense>
                        {complianceDashboard.attention_required.slice(0, 3).map((caseItem) => (
                          <ListItem key={caseItem.case_id} sx={{ px: 0 }}>
                            <ListItemText
                              primary={caseItem.client_name}
                              secondary={`${caseItem.completed_mandatory_items}/${caseItem.mandatory_items} mandatory items`}
                            />
                            <WarningIcon color="warning" fontSize="small" />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="success.main">
                        All cases are compliant!
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Loading compliance data...
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent Cases */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <WorkIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Recent Cases</Typography>
              </Box>
              <List>
                {recentCases.map((caseItem) => (
                  <ListItem key={caseItem.id} divider>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">
                            {caseItem.client_name} - {caseItem.case_number}
                          </Typography>
                          <Chip
                            label={caseItem.status?.replace('_', ' ') || 'Unknown'}
                            color={getStatusColor(caseItem.status)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Debt: {formatCurrency(caseItem.total_debt)} | Stage: {caseItem.debt_stage}
                          </Typography>
                          {caseItem.compliance_completion_percentage !== undefined && (
                            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                              <Typography variant="caption" color="text.secondary">
                                FCA Compliance: {caseItem.compliance_completion_percentage}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={caseItem.compliance_completion_percentage}
                                sx={{ width: 60, height: 4 }}
                                color={caseItem.compliance_completion_percentage >= 80 ? 'success' : 'warning'}
                              />
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <Chip
                      label={caseItem.priority}
                      color={caseItem.priority === 'high' ? 'error' : caseItem.priority === 'medium' ? 'warning' : 'default'}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
              <Box mt={2}>
                <Button
                  variant="outlined"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/cases')}
                  fullWidth
                >
                  View All Cases
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming Appointments */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Today's Appointments</Typography>
              <Button 
                size="small" 
                onClick={() => navigate('/calendar')}
                endIcon={<ArrowForwardIcon />}
                sx={{ fontWeight: 500 }}
              >
                View Calendar
              </Button>
            </Box>
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {upcomingAppointments.slice(0, 5).map((appointment, index) => (
                <Box
                  key={appointment.id}
                  sx={{
                    p: 2,
                    mb: index < upcomingAppointments.slice(0, 5).length - 1 ? 2 : 0,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {appointment.title}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main' }}>
                      {new Date(appointment.appointment_date).toLocaleTimeString('en-GB', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {appointment.client_name}
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Chip
                      label={appointment.status}
                      size="small"
                      color={
                        appointment.status === 'confirmed' ? 'success' :
                        appointment.status === 'scheduled' ? 'info' : 'default'
                      }
                    />
                    {appointment.client_confirmed && (
                      <Chip
                        label="Client Confirmed"
                        size="small"
                        variant="outlined"
                        color="success"
                      />
                    )}
                  </Box>
                </Box>
              ))}
              {upcomingAppointments.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No appointments scheduled for today
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

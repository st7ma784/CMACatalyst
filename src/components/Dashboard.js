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
  Button
} from '@mui/material';
import {
  People as PeopleIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  ArrowForward as ArrowForwardIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [recentCases, setRecentCases] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, casesRes, appointmentsRes] = await Promise.all([
          axios.get('/centres/1/stats'), // Will be dynamic based on user's centre
          axios.get('/cases?limit=5'),
          axios.get('/appointments?start_date=' + new Date().toISOString().split('T')[0] + '&limit=5')
        ]);

        setStats(statsRes.data);
        setRecentCases(casesRes.data);
        setUpcomingAppointments(appointmentsRes.data);
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
            value={stats.active_cases}
            icon={<WorkIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/cases')}
            trend={12}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Clients"
            value={stats.total_clients}
            icon={<PeopleIcon fontSize="large" />}
            color="secondary.main"
            onClick={() => navigate('/clients')}
            trend={8}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Upcoming Appointments"
            value={stats.upcoming_appointments}
            icon={<ScheduleIcon fontSize="large" />}
            color="success.main"
            onClick={() => navigate('/calendar')}
            trend={-3}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Debt Managed"
            value={formatCurrency(stats.total_debt_managed)}
            icon={<AssessmentIcon fontSize="large" />}
            color="warning.main"
            trend={15}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Cases */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent Cases</Typography>
              <Button 
                size="small" 
                onClick={() => navigate('/cases')}
                endIcon={<ArrowForwardIcon />}
                sx={{ fontWeight: 500 }}
              >
                View All
              </Button>
            </Box>
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {recentCases.slice(0, 5).map((case_item, index) => (
                <Box
                  key={case_item.id}
                  sx={{
                    p: 2,
                    mb: index < recentCases.slice(0, 5).length - 1 ? 2 : 0,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      borderColor: 'primary.main',
                    },
                  }}
                  onClick={() => navigate(`/cases/${case_item.id}`)}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {case_item.client_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {case_item.case_number}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Stage: {case_item.debt_stage || 'Not set'}
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Chip
                      label={case_item.priority}
                      size="small"
                      variant="outlined"
                      color={
                        case_item.priority === 'urgent' ? 'error' :
                        case_item.priority === 'high' ? 'warning' :
                        case_item.priority === 'medium' ? 'info' : 'default'
                      }
                    />
                    <Chip
                      label={case_item.status}
                      size="small"
                      color={case_item.status === 'active' ? 'success' : 'default'}
                    />
                  </Box>
                </Box>
              ))}
              {recentCases.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No recent cases found
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
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

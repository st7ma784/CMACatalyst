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
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [recentCases, setRecentCases] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const StatCard = ({ title, value, icon, color, onClick }) => (
    <Card sx={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="h2">
              {value || 0}
            </Typography>
          </Box>
          <Box sx={{ color: color }}>
            {icon}
          </Box>
        </Box>
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Cases"
            value={stats.active_cases}
            icon={<WorkIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/cases')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Clients"
            value={stats.total_clients}
            icon={<PeopleIcon fontSize="large" />}
            color="secondary.main"
            onClick={() => navigate('/clients')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Upcoming Appointments"
            value={stats.upcoming_appointments}
            icon={<CalendarIcon fontSize="large" />}
            color="success.main"
            onClick={() => navigate('/calendar')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Debt Managed"
            value={formatCurrency(stats.total_debt_managed)}
            icon={<TrendingUpIcon fontSize="large" />}
            color="warning.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Cases */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Recent Cases</Typography>
              <Button size="small" onClick={() => navigate('/cases')}>
                View All
              </Button>
            </Box>
            <List>
              {recentCases.slice(0, 5).map((case_item) => (
                <ListItem
                  key={case_item.id}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/cases/${case_item.id}`)}
                >
                  <ListItemText
                    primary={`${case_item.client_name} - ${case_item.case_number}`}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Stage: {case_item.debt_stage || 'Not set'}
                        </Typography>
                        <Box mt={0.5}>
                          <Chip
                            label={case_item.priority}
                            size="small"
                            color={
                              case_item.priority === 'urgent' ? 'error' :
                              case_item.priority === 'high' ? 'warning' :
                              case_item.priority === 'medium' ? 'info' : 'default'
                            }
                          />
                          <Chip
                            label={case_item.status}
                            size="small"
                            sx={{ ml: 1 }}
                            color={case_item.status === 'active' ? 'success' : 'default'}
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Upcoming Appointments */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Today's Appointments</Typography>
              <Button size="small" onClick={() => navigate('/calendar')}>
                View Calendar
              </Button>
            </Box>
            <List>
              {upcomingAppointments.slice(0, 5).map((appointment) => (
                <ListItem key={appointment.id}>
                  <ListItemText
                    primary={appointment.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {appointment.client_name} - {new Date(appointment.appointment_date).toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Typography>
                        <Box mt={0.5}>
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
                              color="success"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

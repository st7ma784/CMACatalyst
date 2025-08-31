import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import axios from 'axios';

const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [appointments, setAppointments] = useState([]);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appointmentDialog, setAppointmentDialog] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    case_id: '',
    user_id: '',
    title: '',
    description: '',
    appointment_date: dayjs(),
    appointment_time: dayjs(),
    duration_minutes: 60,
    location: '',
    appointment_type: 'consultation'
  });

  useEffect(() => {
    fetchAppointments();
    fetchCases();
    fetchUsers();
  }, [selectedDate]);

  const fetchAppointments = async () => {
    try {
      const startDate = selectedDate.startOf('day').toISOString();
      const endDate = selectedDate.endOf('day').toISOString();
      
      const response = await axios.get('/appointments', {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const response = await axios.get('/cases?status=active&limit=100');
      setCases(response.data);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateAppointment = async () => {
    try {
      const appointmentDateTime = selectedDate
        .hour(newAppointment.appointment_time.hour())
        .minute(newAppointment.appointment_time.minute());

      const appointmentData = {
        ...newAppointment,
        appointment_date: appointmentDateTime.toISOString()
      };

      await axios.post('/appointments', appointmentData);
      fetchAppointments();
      setAppointmentDialog(false);
      setNewAppointment({
        case_id: '',
        user_id: '',
        title: '',
        description: '',
        appointment_date: dayjs(),
        appointment_time: dayjs(),
        duration_minutes: 60,
        location: '',
        appointment_type: 'consultation'
      });
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      await axios.put(`/appointments/${appointmentId}`, { status });
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      case 'no_show': return 'warning';
      default: return 'default';
    }
  };

  const getTypeIcon = (type) => {
    return <EventIcon />;
  };

  if (loading) {
    return <Typography>Loading calendar...</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Calendar</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAppointmentDialog(true)}
        >
          New Appointment
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Date Picker */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Select Date
              </Typography>
              <DatePicker
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Appointments for Selected Date */}
        <Grid item xs={12} md={9}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Appointments for {selectedDate.format('dddd, MMMM D, YYYY')}
              </Typography>
              
              {appointments.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="textSecondary">
                    No appointments scheduled for this date
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAppointmentDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Schedule Appointment
                  </Button>
                </Box>
              ) : (
                <List>
                  {appointments
                    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
                    .map((appointment) => (
                    <ListItem key={appointment.id}>
                      <Paper sx={{ width: '100%', p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Box flex={1}>
                            <Typography variant="h6">
                              {appointment.title}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              {appointment.client_name} - {appointment.case_number}
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                              {new Date(appointment.appointment_date).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })} ({appointment.duration_minutes} minutes)
                            </Typography>
                            {appointment.location && (
                              <Typography variant="body2" color="textSecondary">
                                Location: {appointment.location}
                              </Typography>
                            )}
                            {appointment.description && (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {appointment.description}
                              </Typography>
                            )}
                            <Box mt={1}>
                              <Chip
                                label={appointment.status}
                                size="small"
                                color={getStatusColor(appointment.status)}
                                sx={{ mr: 1 }}
                              />
                              <Chip
                                label={appointment.appointment_type}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                              {appointment.client_confirmed && (
                                <Chip
                                  label="Client Confirmed"
                                  size="small"
                                  color="success"
                                />
                              )}
                            </Box>
                          </Box>
                          <Box>
                            {appointment.status === 'scheduled' && (
                              <>
                                <Button
                                  size="small"
                                  color="success"
                                  onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                                  sx={{ mr: 1 }}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                            {appointment.status === 'confirmed' && (
                              <>
                                <Button
                                  size="small"
                                  color="primary"
                                  onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                                  sx={{ mr: 1 }}
                                >
                                  Complete
                                </Button>
                                <Button
                                  size="small"
                                  color="warning"
                                  onClick={() => updateAppointmentStatus(appointment.id, 'no_show')}
                                >
                                  No Show
                                </Button>
                              </>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* New Appointment Dialog */}
      <Dialog open={appointmentDialog} onClose={() => setAppointmentDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Schedule New Appointment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Case"
                required
                value={newAppointment.case_id}
                onChange={(e) => setNewAppointment({...newAppointment, case_id: e.target.value})}
              >
                {cases.map((case_item) => (
                  <MenuItem key={case_item.id} value={case_item.id}>
                    {case_item.client_name} - {case_item.case_number}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Advisor"
                required
                value={newAppointment.user_id}
                onChange={(e) => setNewAppointment({...newAppointment, user_id: e.target.value})}
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                required
                value={newAppointment.title}
                onChange={(e) => setNewAppointment({...newAppointment, title: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TimePicker
                label="Time"
                value={newAppointment.appointment_time}
                onChange={(newValue) => setNewAppointment({...newAppointment, appointment_time: newValue})}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                type="number"
                value={newAppointment.duration_minutes}
                onChange={(e) => setNewAppointment({...newAppointment, duration_minutes: parseInt(e.target.value)})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Type"
                value={newAppointment.appointment_type}
                onChange={(e) => setNewAppointment({...newAppointment, appointment_type: e.target.value})}
              >
                <MenuItem value="consultation">Consultation</MenuItem>
                <MenuItem value="follow_up">Follow Up</MenuItem>
                <MenuItem value="phone_call">Phone Call</MenuItem>
                <MenuItem value="home_visit">Home Visit</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                value={newAppointment.location}
                onChange={(e) => setNewAppointment({...newAppointment, location: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={newAppointment.description}
                onChange={(e) => setNewAppointment({...newAppointment, description: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppointmentDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateAppointment} 
            variant="contained"
            disabled={!newAppointment.case_id || !newAppointment.user_id || !newAppointment.title}
          >
            Schedule Appointment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Calendar;

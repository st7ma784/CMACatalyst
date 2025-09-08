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
  Paper,
  FormControlLabel,
  Switch,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Badge,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  ViewWeek as WeekIcon,
  ViewModule as MonthIcon,
  Today as TodayIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon
} from '@mui/icons-material';
import { DatePicker, TimePicker, DateCalendar } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import axios from 'axios';

const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [appointments, setAppointments] = useState([]);
  const [monthlyAppointments, setMonthlyAppointments] = useState([]);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appointmentDialog, setAppointmentDialog] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // 'day', 'week', 'month'
  const [showAllUsers, setShowAllUsers] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [error, setError] = useState('');
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
    fetchCases();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (viewMode === 'day') {
      fetchAppointments();
    } else {
      fetchMonthlyAppointments();
    }
  }, [selectedDate, currentMonth, selectedUsers, viewMode]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const startDate = selectedDate.startOf('day').toISOString();
      const endDate = selectedDate.endOf('day').toISOString();
      
      const response = await axios.get('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          start_date: startDate,
          end_date: endDate,
          user_ids: showAllUsers ? selectedUsers.join(',') : undefined
        }
      });
      setAppointments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError('Failed to load appointments');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyAppointments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const startDate = currentMonth.startOf('month').toISOString();
      const endDate = currentMonth.endOf('month').toISOString();
      
      const response = await axios.get('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          start_date: startDate,
          end_date: endDate,
          user_ids: showAllUsers ? selectedUsers.join(',') : undefined
        }
      });
      setMonthlyAppointments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching monthly appointments:', error);
      setError('Failed to load appointments');
      setMonthlyAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/cases?status=active&limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCases(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching cases:', error);
      setCases([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const usersData = Array.isArray(response.data) ? response.data : [];
      setUsers(usersData);
      setSelectedUsers(usersData.map(u => u.id));
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load center staff');
      setUsers([]);
      setSelectedUsers([]);
    }
  };

  const getAppointmentsForDate = (date) => {
    return (Array.isArray(monthlyAppointments) ? monthlyAppointments : []).filter(apt => 
      dayjs(apt.appointment_date).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
    );
  };

  const renderMonthView = () => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDate = startOfMonth.startOf('week');
    const endDate = endOfMonth.endOf('week');

    const days = [];
    let current = startDate;

    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }

    return (
      <Grid container spacing={1} sx={{ mt: 1 }}>
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Grid item xs={12/7} key={day}>
            <Typography variant="body2" align="center" fontWeight={600} color="text.secondary">
              {day}
            </Typography>
          </Grid>
        ))}
        
        {/* Calendar days */}
        {days.map((day, index) => {
          const dayAppointments = getAppointmentsForDate(day);
          const isCurrentMonth = day.month() === currentMonth.month();
          const isToday = day.isSame(dayjs(), 'day');
          const isSelected = day.isSame(selectedDate, 'day');

          return (
            <Grid item xs={12/7} key={index}>
              <Paper
                sx={{
                  minHeight: 100,
                  p: 1,
                  cursor: 'pointer',
                  border: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  backgroundColor: isToday ? 'primary.50' : isCurrentMonth ? 'background.paper' : 'background.default',
                  opacity: isCurrentMonth ? 1 : 0.6,
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
                onClick={() => {
                  setSelectedDate(day);
                  setViewMode('day');
                }}
              >
                <Typography variant="body2" fontWeight={isToday ? 600 : 400} color={isToday ? 'primary.main' : 'text.primary'}>
                  {day.date()}
                </Typography>
                
                {dayAppointments.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    {dayAppointments.slice(0, 2).map((apt, idx) => (
                      <Chip
                        key={idx}
                        label={apt.title}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 18,
                          mb: 0.25,
                          display: 'block',
                          '& .MuiChip-label': {
                            px: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%'
                          }
                        }}
                        color={getStatusColor(apt.status)}
                      />
                    ))}
                    {dayAppointments.length > 2 && (
                      <Typography variant="caption" color="text.secondary">
                        +{dayAppointments.length - 2} more
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    );
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

      const token = localStorage.getItem('token');
      await axios.post('/api/appointments', appointmentData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token');
      await axios.put(`/api/appointments/${appointmentId}`, { status }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
    <Box className="fade-in" sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>Calendar</Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={() => {
              setSelectedDate(dayjs());
              setCurrentMonth(dayjs());
            }}
            sx={{ 
              color: 'white', 
              borderColor: 'rgba(255,255,255,0.3)',
              textTransform: 'none',
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            Today
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAppointmentDialog(true)}
            className="gradient-button"
            sx={{ textTransform: 'none' }}
          >
            New Appointment
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* View Controls */}
      <Card className="modern-card" sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <IconButton 
                  onClick={() => {
                    if (viewMode === 'month') {
                      setCurrentMonth(currentMonth.subtract(1, 'month'));
                    } else {
                      setSelectedDate(selectedDate.subtract(1, 'day'));
                    }
                  }}
                  size="small"
                >
                  <PrevIcon />
                </IconButton>
                
                <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
                  {viewMode === 'month' 
                    ? currentMonth.format('MMMM YYYY')
                    : selectedDate.format('dddd, MMMM D, YYYY')
                  }
                </Typography>
                
                <IconButton 
                  onClick={() => {
                    if (viewMode === 'month') {
                      setCurrentMonth(currentMonth.add(1, 'month'));
                    } else {
                      setSelectedDate(selectedDate.add(1, 'day'));
                    }
                  }}
                  size="small"
                >
                  <NextIcon />
                </IconButton>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box display="flex" gap={1}>
                <Button
                  variant={viewMode === 'day' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setViewMode('day')}
                  sx={{ textTransform: 'none' }}
                >
                  Day
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<MonthIcon />}
                  onClick={() => setViewMode('month')}
                  sx={{ textTransform: 'none' }}
                >
                  Month
                </Button>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Center Members</InputLabel>
                <Select
                  multiple
                  value={selectedUsers}
                  onChange={(e) => setSelectedUsers(e.target.value)}
                  label="Center Members"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(Array.isArray(selected) ? selected : []).length === users.length ? (
                        <Chip label="All Members" size="small" />
                      ) : (
                        (Array.isArray(selected) ? selected : []).slice(0, 2).map((userId) => {
                          const user = users.find(u => u.id === userId);
                          return user ? (
                            <Chip key={userId} label={user.first_name} size="small" />
                          ) : null;
                        }).concat((Array.isArray(selected) ? selected : []).length > 2 ? [
                          <Chip key="more" label={`+${(Array.isArray(selected) ? selected : []).length - 2} more`} size="small" />
                        ] : [])
                      )}
                    </Box>
                  )}
                >
                  <MenuItem value="all" onClick={() => {
                    setSelectedUsers(selectedUsers.length === users.length ? [] : users.map(u => u.id));
                  }}>
                    <Chip 
                      icon={<PeopleIcon />}
                      label={selectedUsers.length === users.length ? "Deselect All" : "Select All"}
                      size="small"
                    />
                  </MenuItem>
                  <Divider />
                  {(Array.isArray(users) ? users : []).map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                          {user.first_name[0]}
                        </Avatar>
                        {user.first_name} {user.last_name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Calendar Views */}
      {viewMode === 'month' ? (
        <Card className="modern-card">
          <CardContent sx={{ p: 3 }}>
            {renderMonthView()}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {/* Day View */}
          <Grid item xs={12}>
            <Card className="modern-card">
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EventIcon /> Appointments for {selectedDate.format('dddd, MMMM D, YYYY')}
                </Typography>
                {selectedUsers.length > 0 && (
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Showing appointments for {selectedUsers.length} staff member{selectedUsers.length !== 1 ? 's' : ''}
                  </Typography>
                )}
                
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
                      className="gradient-button"
                    >
                      Schedule Appointment
                    </Button>
                  </Box>
                ) : (
                  <List>
                    {(Array.isArray(appointments) ? appointments : [])
                      .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
                      .map((appointment) => (
                      <ListItem key={appointment.id} sx={{ px: 0 }}>
                        <Paper sx={{ width: '100%', p: 3, mb: 2, borderRadius: 2 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                            <Box flex={1}>
                              <Typography variant="h6" gutterBottom>
                                {appointment.title}
                              </Typography>
                              <Typography variant="body2" color="textSecondary" gutterBottom>
                                {appointment.client_name} - {appointment.case_number}
                              </Typography>
                              <Typography variant="body2" color="primary" gutterBottom>
                                Advisor: {appointment.advisor_name}
                              </Typography>
                              <Typography variant="body1" sx={{ mb: 1 }}>
                                {new Date(appointment.appointment_date).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} ({appointment.duration_minutes} minutes)
                              </Typography>
                              {appointment.location && (
                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                  Location: {appointment.location}
                                </Typography>
                              )}
                              {appointment.description && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {appointment.description}
                                </Typography>
                              )}
                              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                                <Chip
                                  label={appointment.status}
                                  size="small"
                                  color={getStatusColor(appointment.status)}
                                />
                                <Chip
                                  label={appointment.appointment_type}
                                  size="small"
                                  variant="outlined"
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
                            <Box display="flex" flexDirection="column" gap={1}>
                              {appointment.status === 'scheduled' && (
                                <>
                                  <Button
                                    size="small"
                                    color="success"
                                    onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                                    variant="outlined"
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    size="small"
                                    color="error"
                                    onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                                    variant="outlined"
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
                                    variant="outlined"
                                  >
                                    Complete
                                  </Button>
                                  <Button
                                    size="small"
                                    color="warning"
                                    onClick={() => updateAppointmentStatus(appointment.id, 'no_show')}
                                    variant="outlined"
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
      )}

      {/* New Appointment Dialog */}
      <Dialog 
        open={appointmentDialog} 
        onClose={() => setAppointmentDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 }
        }}
      >
        <DialogTitle sx={{ pb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Schedule New Appointment
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Case"
                required
                value={newAppointment.case_id}
                onChange={(e) => setNewAppointment({...newAppointment, case_id: e.target.value})}
                variant="outlined"
              >
                {(Array.isArray(cases) ? cases : []).map((case_item) => (
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
                variant="outlined"
              >
                {(Array.isArray(users) ? users : []).map((user) => (
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
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TimePicker
                label="Time"
                value={newAppointment.appointment_time}
                onChange={(newValue) => setNewAppointment({...newAppointment, appointment_time: newValue})}
                renderInput={(params) => <TextField {...params} fullWidth variant="outlined" />}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                type="number"
                value={newAppointment.duration_minutes}
                onChange={(e) => setNewAppointment({...newAppointment, duration_minutes: parseInt(e.target.value)})}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Type"
                value={newAppointment.appointment_type}
                onChange={(e) => setNewAppointment({...newAppointment, appointment_type: e.target.value})}
                variant="outlined"
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
                variant="outlined"
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
                variant="outlined"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setAppointmentDialog(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateAppointment} 
            variant="contained"
            disabled={!newAppointment.case_id || !newAppointment.user_id || !newAppointment.title}
            className="gradient-button"
            sx={{ textTransform: 'none', px: 3 }}
          >
            Schedule Appointment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Calendar;

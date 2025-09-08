import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  Card,
  CardContent,
  Avatar,
  Skeleton,
  Fade
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [newClient, setNewClient] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    national_insurance_number: '',
    relationship_status: '',
    dependents: 0,
    employment_status: ''
  });
  const [errors, setErrors] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClients();
  }, [search]);

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/clients', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: { search, limit: 50 }
      });
      const clientsData = response.data.clients || response.data;
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]); // Ensure clients is always an array
    } finally {
      setLoading(false);
    }
  };

  // Validate phone number format
  const validatePhoneNumber = (phone) => {
    if (!phone) return true; // Phone is optional
    const ukPhoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?[1-9]\d{2,4}|\(?0[1-9]\d{2,4}\)?)\s?\d{3,6}$/;
    return ukPhoneRegex.test(phone.replace(/\s/g, ''));
  };

  // Validate form data
  const validateForm = () => {
    const newErrors = {};
    
    if (!newClient.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    
    if (!newClient.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    
    if (newClient.email && !/\S+@\S+\.\S+/.test(newClient.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (newClient.phone && !validatePhoneNumber(newClient.phone)) {
      newErrors.phone = 'Please enter a valid UK phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateClient = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/clients', newClient, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setClients([response.data.client, ...clients]);
      setOpenDialog(false);
      setNewClient({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        date_of_birth: '',
        national_insurance_number: '',
        relationship_status: '',
        dependents: 0,
        employment_status: ''
      });
      setErrors({});
      setDuplicateWarning(null);
    } catch (error) {
      console.error('Error creating client:', error);
      if (error.response?.status === 409) {
        setDuplicateWarning(error.response.data.message);
      } else {
        setErrors({ general: 'Failed to create client. Please try again.' });
      }
    }
  };

  const handleInputChange = (field, value) => {
    setNewClient(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const filteredClients = (Array.isArray(clients) ? clients : []).filter(client => 
    client.first_name?.toLowerCase().includes(search.toLowerCase()) || 
    client.last_name?.toLowerCase().includes(search.toLowerCase()) || 
    client.email?.toLowerCase().includes(search.toLowerCase()) || 
    client.phone?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[...Array(6)].map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Skeleton variant="circular" width={48} height={48} />
                  <Box ml={2} flex={1}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
                <Skeleton variant="text" />
                <Skeleton variant="text" width="80%" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 0 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Clients
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your client database and case assignments
        </Typography>
      </Box>
      
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box display="flex" gap={2} alignItems="center" flex={1}>
          <TextField
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            sx={{ minWidth: 'auto' }}
          >
            Filter
          </Button>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{ minWidth: 'auto' }}
        >
          Add Client
        </Button>
      </Box>

      {filteredClients.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No clients found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {search ? 'Try adjusting your search criteria' : 'Get started by adding your first client'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Add Client
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredClients.map((client, index) => (
            <Fade in={true} timeout={300 + index * 100} key={client.id}>
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 25px 0 rgba(0, 0, 0, 0.1)',
                    },
                  }}
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar 
                        sx={{ 
                          width: 48, 
                          height: 48, 
                          backgroundColor: 'primary.main',
                          mr: 2
                        }}
                      >
                        <PersonIcon />
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {client.first_name} {client.last_name}
                        </Typography>
                        <Chip
                          label={client.status || 'Active'}
                          color={client.status === 'Active' ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                    
                    <Box sx={{ mb: 2 }}>
                      {client.email && (
                        <Box display="flex" alignItems="center" mb={1}>
                          <EmailIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 1 }} />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {client.email}
                          </Typography>
                        </Box>
                      )}
                      {client.phone && (
                        <Box display="flex" alignItems="center">
                          <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            {client.phone}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {client.case_count || 0} active cases
                      </Typography>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/clients/${client.id}`);
                          }}
                          sx={{ mr: 1 }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle edit
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Fade>
          ))}
        </Grid>
      )}
      
      {/* Add Client Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Client</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {duplicateWarning && (
              <Grid item xs={12}>
                <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="warning" />
                  <Typography variant="body2" color="warning.dark">
                    {duplicateWarning}
                  </Typography>
                </Box>
              </Grid>
            )}
            {errors.general && (
              <Grid item xs={12}>
                <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                  <Typography variant="body2" color="error.dark">
                    {errors.general}
                  </Typography>
                </Box>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                required
                value={newClient.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                error={!!errors.first_name}
                helperText={errors.first_name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                required
                value={newClient.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                error={!!errors.last_name}
                helperText={errors.last_name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newClient.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={newClient.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                error={!!errors.phone}
                helperText={errors.phone || "UK format: 07123 456789 or +44 7123 456789"}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={newClient.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={newClient.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Relationship Status"
                value={newClient.relationship_status}
                onChange={(e) => handleInputChange('relationship_status', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Dependents"
                type="number"
                value={newClient.dependents}
                onChange={(e) => handleInputChange('dependents', parseInt(e.target.value) || 0)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Employment Status"
                value={newClient.employment_status}
                onChange={(e) => handleInputChange('employment_status', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateClient} 
            variant="contained"
            disabled={!newClient.first_name || !newClient.last_name}
          >
            Create Client
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientList;

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Description as NotesIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  AttachMoney as MoneyIcon,
  Gavel as LegalIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Creditors = () => {
  const [creditors, setCreditors] = useState([]);
  const [selectedCreditor, setSelectedCreditor] = useState(null);
  const [correspondenceHistory, setCorrespondenceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCreditor, setEditingCreditor] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    notes: '',
    creditor_type: 'credit_card',
    preferred_contact_method: 'email'
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchCreditors();
  }, []);

  const fetchCreditors = async () => {
    try {
      const response = await axios.get('/api/creditors');
      setCreditors(response.data);
    } catch (error) {
      console.error('Error fetching creditors:', error);
      setError('Failed to load creditors');
    } finally {
      setLoading(false);
    }
  };

  const fetchCorrespondenceHistory = async (creditorId) => {
    try {
      const response = await axios.get(`/api/creditors/${creditorId}/correspondence`);
      setCorrespondenceHistory(response.data);
    } catch (error) {
      console.error('Error fetching correspondence:', error);
    }
  };

  const handleCreditorSelect = (creditor) => {
    setSelectedCreditor(creditor);
    fetchCorrespondenceHistory(creditor.id);
    setTabValue(0);
  };

  const handleOpenDialog = (creditor = null) => {
    if (creditor) {
      setEditingCreditor(creditor);
      setFormData({
        name: creditor.name,
        contact_person: creditor.contact_person || '',
        phone: creditor.phone || '',
        email: creditor.email || '',
        address: creditor.address || '',
        website: creditor.website || '',
        notes: creditor.notes || '',
        creditor_type: creditor.creditor_type || 'credit_card',
        preferred_contact_method: creditor.preferred_contact_method || 'email'
      });
    } else {
      setEditingCreditor(null);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        website: '',
        notes: '',
        creditor_type: 'credit_card',
        preferred_contact_method: 'email'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCreditor(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingCreditor) {
        await axios.put(`/api/creditors/${editingCreditor.id}`, formData);
      } else {
        await axios.post('/api/creditors', formData);
      }
      fetchCreditors();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving creditor:', error);
      setError('Failed to save creditor');
    }
  };

  const handleDelete = async (creditorId) => {
    if (window.confirm('Are you sure you want to delete this creditor?')) {
      try {
        await axios.delete(`/api/creditors/${creditorId}`);
        fetchCreditors();
        if (selectedCreditor?.id === creditorId) {
          setSelectedCreditor(null);
        }
      } catch (error) {
        console.error('Error deleting creditor:', error);
        setError('Failed to delete creditor');
      }
    }
  };

  const getCreditorTypeColor = (type) => {
    switch (type) {
      case 'credit_card': return 'primary';
      case 'loan': return 'secondary';
      case 'mortgage': return 'success';
      case 'utility': return 'warning';
      case 'other': return 'default';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading creditors...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Creditors Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Creditor
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Creditors List */}
        <Grid item xs={12} md={selectedCreditor ? 6 : 12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <BusinessIcon sx={{ mr: 1 }} />
                All Creditors ({creditors.length})
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Cases</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {creditors.map((creditor) => (
                      <TableRow 
                        key={creditor.id}
                        hover
                        onClick={() => handleCreditorSelect(creditor)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {creditor.name}
                          </Typography>
                          {creditor.contact_person && (
                            <Typography variant="caption" color="text.secondary">
                              Contact: {creditor.contact_person}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={creditor.creditor_type?.replace('_', ' ')} 
                            size="small" 
                            color={getCreditorTypeColor(creditor.creditor_type)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            {creditor.phone && (
                              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                                <PhoneIcon sx={{ fontSize: 12, mr: 0.5 }} />
                                {creditor.phone}
                              </Typography>
                            )}
                            {creditor.email && (
                              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                                <EmailIcon sx={{ fontSize: 12, mr: 0.5 }} />
                                {creditor.email}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={creditor.case_count || 0} 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(creditor);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(creditor.id);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {creditors.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography color="text.secondary">No creditors found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Creditor Details */}
        {selectedCreditor && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {selectedCreditor.name}
                </Typography>
                
                <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                  <Tab label="Details" />
                  <Tab label="Correspondence" />
                  <Tab label="Cases" />
                </Tabs>

                {/* Details Tab */}
                {tabValue === 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">Contact Person</Typography>
                        <Typography>{selectedCreditor.contact_person || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Phone</Typography>
                        <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                          <PhoneIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          {selectedCreditor.phone || 'Not provided'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                        <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                          <EmailIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          {selectedCreditor.email || 'Not provided'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                        <Typography sx={{ display: 'flex', alignItems: 'flex-start' }}>
                          <LocationIcon sx={{ fontSize: 16, mr: 0.5, mt: 0.2 }} />
                          {selectedCreditor.address || 'Not provided'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                        <Typography sx={{ display: 'flex', alignItems: 'flex-start' }}>
                          <NotesIcon sx={{ fontSize: 16, mr: 0.5, mt: 0.2 }} />
                          {selectedCreditor.notes || 'No notes'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Correspondence Tab */}
                {tabValue === 1 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                      <HistoryIcon sx={{ mr: 1 }} />
                      Correspondence History
                    </Typography>
                    <List>
                      {correspondenceHistory.map((item, index) => (
                        <React.Fragment key={index}>
                          <ListItem>
                            <ListItemText
                              primary={item.subject || 'No subject'}
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    {item.type} • {new Date(item.date).toLocaleDateString()}
                                  </Typography>
                                  <Typography variant="body2">
                                    {item.summary || 'No summary available'}
                                  </Typography>
                                </Box>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Chip 
                                label={item.status || 'pending'} 
                                size="small" 
                                color={item.status === 'resolved' ? 'success' : 'warning'}
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                          {index < correspondenceHistory.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                      {correspondenceHistory.length === 0 && (
                        <ListItem>
                          <ListItemText 
                            primary="No correspondence history"
                            secondary="No previous communication records found"
                          />
                        </ListItem>
                      )}
                    </List>
                  </Box>
                )}

                {/* Cases Tab */}
                {tabValue === 2 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Related Cases
                    </Typography>
                    <Typography color="text.secondary">
                      Cases involving this creditor will be displayed here.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Creditor Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCreditor ? 'Edit Creditor' : 'Add New Creditor'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Creditor Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Creditor Type"
                  select
                  value={formData.creditor_type}
                  onChange={(e) => setFormData({ ...formData, creditor_type: e.target.value })}
                  SelectProps={{ native: true }}
                >
                  <option value="credit_card">Credit Card</option>
                  <option value="loan">Loan</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="utility">Utility</option>
                  <option value="other">Other</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Preferred Contact Method"
                  select
                  value={formData.preferred_contact_method}
                  onChange={(e) => setFormData({ ...formData, preferred_contact_method: e.target.value })}
                  SelectProps={{ native: true }}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="post">Post</option>
                  <option value="online">Online Portal</option>
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCreditor ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Creditors;

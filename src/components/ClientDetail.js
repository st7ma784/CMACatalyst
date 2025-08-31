import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import axios from 'axios';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [caseDialog, setCaseDialog] = useState(false);
  const [editedClient, setEditedClient] = useState({});
  const [newCase, setNewCase] = useState({
    debt_stage: '',
    priority: 'medium',
    total_debt: '',
    monthly_income: '',
    monthly_expenses: ''
  });

  useEffect(() => {
    fetchClientData();
  }, [id]);

  const fetchClientData = async () => {
    try {
      const [clientRes, casesRes] = await Promise.all([
        axios.get(`/clients/${id}`),
        axios.get(`/clients/${id}/cases`)
      ]);
      setClient(clientRes.data);
      setCases(casesRes.data);
      setEditedClient(clientRes.data);
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClient = async () => {
    try {
      const response = await axios.put(`/clients/${id}`, editedClient);
      setClient(response.data.client);
      setEditDialog(false);
    } catch (error) {
      console.error('Error updating client:', error);
    }
  };

  const handleCreateCase = async () => {
    try {
      const response = await axios.post('/cases', {
        client_id: parseInt(id),
        ...newCase
      });
      setCases([response.data.case, ...cases]);
      setCaseDialog(false);
      setNewCase({
        debt_stage: '',
        priority: 'medium',
        total_debt: '',
        monthly_income: '',
        monthly_expenses: ''
      });
    } catch (error) {
      console.error('Error creating case:', error);
    }
  };

  if (loading) {
    return <Typography>Loading client details...</Typography>;
  }

  if (!client) {
    return <Typography>Client not found</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          {client.first_name} {client.last_name}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditDialog(true)}
            sx={{ mr: 2 }}
          >
            Edit Client
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCaseDialog(true)}
          >
            New Case
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Client Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Personal Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Email
                  </Typography>
                  <Typography variant="body1">
                    {client.email || 'Not provided'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Phone
                  </Typography>
                  <Typography variant="body1">
                    {client.phone || 'Not provided'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">
                    Address
                  </Typography>
                  <Typography variant="body1">
                    {client.address || 'Not provided'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Date of Birth
                  </Typography>
                  <Typography variant="body1">
                    {client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString() : 'Not provided'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Relationship Status
                  </Typography>
                  <Typography variant="body1">
                    {client.relationship_status || 'Not provided'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Dependents
                  </Typography>
                  <Typography variant="body1">
                    {client.dependents || 0}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Employment
                  </Typography>
                  <Typography variant="body1">
                    {client.employment_status || 'Not provided'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Cases */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cases ({cases.length})
              </Typography>
              {cases.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Case Number</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Priority</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cases.map((case_item) => (
                        <TableRow 
                          key={case_item.id}
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/cases/${case_item.id}`)}
                        >
                          <TableCell>{case_item.case_number}</TableCell>
                          <TableCell>{case_item.debt_stage || 'Not set'}</TableCell>
                          <TableCell>
                            <Chip
                              label={case_item.status}
                              size="small"
                              color={case_item.status === 'active' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={case_item.priority}
                              size="small"
                              color={
                                case_item.priority === 'urgent' ? 'error' :
                                case_item.priority === 'high' ? 'warning' :
                                case_item.priority === 'medium' ? 'info' : 'default'
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box textAlign="center" py={3}>
                  <WorkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="textSecondary">
                    No cases found for this client
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCaseDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Create First Case
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Client Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Client</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={editedClient.first_name || ''}
                onChange={(e) => setEditedClient({...editedClient, first_name: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={editedClient.last_name || ''}
                onChange={(e) => setEditedClient({...editedClient, last_name: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                value={editedClient.email || ''}
                onChange={(e) => setEditedClient({...editedClient, email: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={editedClient.phone || ''}
                onChange={(e) => setEditedClient({...editedClient, phone: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={editedClient.address || ''}
                onChange={(e) => setEditedClient({...editedClient, address: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateClient} variant="contained">
            Update Client
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Case Dialog */}
      <Dialog open={caseDialog} onClose={() => setCaseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Case</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Debt Stage"
                select
                value={newCase.debt_stage}
                onChange={(e) => setNewCase({...newCase, debt_stage: e.target.value})}
              >
                <MenuItem value="assessment">Assessment</MenuItem>
                <MenuItem value="budgeting">Budgeting</MenuItem>
                <MenuItem value="negotiation">Negotiation</MenuItem>
                <MenuItem value="insolvency">Insolvency</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Priority"
                select
                value={newCase.priority}
                onChange={(e) => setNewCase({...newCase, priority: e.target.value})}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Total Debt (£)"
                type="number"
                value={newCase.total_debt}
                onChange={(e) => setNewCase({...newCase, total_debt: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Monthly Income (£)"
                type="number"
                value={newCase.monthly_income}
                onChange={(e) => setNewCase({...newCase, monthly_income: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Monthly Expenses (£)"
                type="number"
                value={newCase.monthly_expenses}
                onChange={(e) => setNewCase({...newCase, monthly_expenses: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCaseDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateCase} variant="contained">
            Create Case
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientDetail;

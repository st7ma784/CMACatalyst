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
  MenuItem,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Work as WorkIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon,
  ChecklistRtl as ChecklistIcon,
  Note as NoteIcon,
  AttachMoney as MoneyIcon,
  Mail as MailIcon,
  Folder as FolderIcon,
  SupervisorAccount as SupervisorIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import axios from 'axios';
import FCAComplianceChecklist from './FCAComplianceChecklist';
import DocumentUpload from './DocumentUpload';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  
  // Dialog states
  const [editDialog, setEditDialog] = useState(false);
  const [caseDialog, setCaseDialog] = useState(false);
  const [editedClient, setEditedClient] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Case creation state
  const [newCase, setNewCase] = useState({
    debt_stage: '',
    priority: 'medium',
    total_debt: '',
    monthly_income: '',
    monthly_expenses: ''
  });
  
  // Money management states
  const [income, setIncome] = useState([]);
  const [expenditure, setExpenditure] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savings, setSavings] = useState([]);
  const [assets, setAssets] = useState([]);
  const [financialStatements, setFinancialStatements] = useState([]);
  
  // Notes and compliance states
  const [notes, setNotes] = useState([]);
  const [complianceChecks, setComplianceChecks] = useState([]);
  
  // Caseworkers and household
  const [caseworkers, setCaseworkers] = useState([]);
  const [householdMembers, setHouseholdMembers] = useState([]);
  
  // Files and letters
  const [files, setFiles] = useState([]);
  const [letters, setLetters] = useState([]);
  const [deleteFileDialog, setDeleteFileDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  
  // Dialog states for adding items
  const [addIncomeDialog, setAddIncomeDialog] = useState(false);
  const [addExpenditureDialog, setAddExpenditureDialog] = useState(false);
  const [addDebtDialog, setAddDebtDialog] = useState(false);
  const [addAssetDialog, setAddAssetDialog] = useState(false);
  const [addNoteDialog, setAddNoteDialog] = useState(false);
  const [addCaseworkerDialog, setAddCaseworkerDialog] = useState(false);
  const [addHouseholdDialog, setAddHouseholdDialog] = useState(false);
  
  // Form states for new items
  const [newIncome, setNewIncome] = useState({ source: '', amount: '', frequency: 'monthly', type: 'employment' });
  const [newExpenditure, setNewExpenditure] = useState({ category: '', amount: '', frequency: 'monthly', description: '' });
  const [newDebt, setNewDebt] = useState({ creditor_name: '', debt_type: '', current_balance: '', minimum_payment: '', is_priority: false });
  const [newAsset, setNewAsset] = useState({ asset_type: '', description: '', estimated_value: '', is_secured: false });
  const [newNote, setNewNote] = useState({ title: '', content: '', note_type: 'general' });
  const [newCaseworker, setNewCaseworker] = useState({ name: '', role: '', email: '', phone: '' });
  const [newHouseholdMember, setNewHouseholdMember] = useState({ name: '', relationship: '', age: '', dependent: false });

  useEffect(() => {
    fetchClientData();
    fetchFinancialData();
    fetchNotes();
    fetchCaseworkers();
    fetchHouseholdMembers();
    fetchFiles();
    fetchLetters();
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

  const fetchFinancialData = async () => {
    try {
      const [incomeRes, expenditureRes, debtsRes, savingsRes, assetsRes] = await Promise.all([
        axios.get(`/clients/${id}/income`),
        axios.get(`/clients/${id}/expenditure`),
        axios.get(`/clients/${id}/debts`),
        axios.get(`/clients/${id}/savings`),
        axios.get(`/clients/${id}/assets`)
      ]);
      setIncome(incomeRes.data || []);
      setExpenditure(expenditureRes.data || []);
      setDebts(debtsRes.data || []);
      setSavings(savingsRes.data || []);
      setAssets(assetsRes.data || []);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`/notes/client/${id}`);
      setNotes(response.data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const fetchCaseworkers = async () => {
    try {
      const response = await axios.get(`/clients/${id}/caseworkers`);
      setCaseworkers(response.data || []);
    } catch (error) {
      console.error('Error fetching caseworkers:', error);
    }
  };

  const fetchHouseholdMembers = async () => {
    try {
      const response = await axios.get(`/clients/${id}/household`);
      setHouseholdMembers(response.data || []);
    } catch (error) {
      console.error('Error fetching household members:', error);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`/files/client/${id}`);
      setFiles(response.data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchLetters = async () => {
    try {
      const response = await axios.get(`/letters/client/${id}`);
      setLetters(response.data || []);
    } catch (error) {
      console.error('Error fetching letters:', error);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    try {
      await axios.delete(`/files/${fileToDelete.id}`);
      setSnackbar({ open: true, message: 'File deleted successfully', severity: 'success' });
      setDeleteFileDialog(false);
      setFileToDelete(null);
      fetchFiles(); // Refresh file list
    } catch (error) {
      console.error('Error deleting file:', error);
      setSnackbar({ open: true, message: 'Error deleting file', severity: 'error' });
    }
  };

  const handleUpdateClient = async () => {
    try {
      const response = await axios.put(`/clients/${id}`, editedClient);
      setClient(response.data.client);
      setEditDialog(false);
      setSnackbar({ open: true, message: 'Client updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error updating client:', error);
      setSnackbar({ open: true, message: 'Error updating client', severity: 'error' });
    }
  };

  // Financial data handlers
  const handleAddIncome = async () => {
    try {
      await axios.post(`/clients/${id}/income`, newIncome);
      fetchFinancialData();
      setAddIncomeDialog(false);
      setNewIncome({ source: '', amount: '', frequency: 'monthly', type: 'employment' });
      setSnackbar({ open: true, message: 'Income added successfully', severity: 'success' });
    } catch (error) {
      console.error('Error adding income:', error);
      setSnackbar({ open: true, message: 'Error adding income', severity: 'error' });
    }
  };

  const handleAddExpenditure = async () => {
    try {
      await axios.post(`/clients/${id}/expenditure`, newExpenditure);
      fetchFinancialData();
      setAddExpenditureDialog(false);
      setNewExpenditure({ category: '', amount: '', frequency: 'monthly', description: '' });
      setSnackbar({ open: true, message: 'Expenditure added successfully', severity: 'success' });
    } catch (error) {
      console.error('Error adding expenditure:', error);
      setSnackbar({ open: true, message: 'Error adding expenditure', severity: 'error' });
    }
  };

  const handleAddDebt = async () => {
    try {
      await axios.post(`/clients/${id}/debts`, newDebt);
      fetchFinancialData();
      setAddDebtDialog(false);
      setNewDebt({ creditor_name: '', debt_type: '', current_balance: '', minimum_payment: '', is_priority: false });
      setSnackbar({ open: true, message: 'Debt added successfully', severity: 'success' });
    } catch (error) {
      console.error('Error adding debt:', error);
      setSnackbar({ open: true, message: 'Error adding debt', severity: 'error' });
    }
  };

  const handleAddAsset = async () => {
    try {
      await axios.post(`/clients/${id}/assets`, newAsset);
      fetchFinancialData();
      setAddAssetDialog(false);
      setNewAsset({ asset_type: '', description: '', estimated_value: '', is_secured: false });
      setSnackbar({ open: true, message: 'Asset added successfully', severity: 'success' });
    } catch (error) {
      console.error('Error adding asset:', error);
      setSnackbar({ open: true, message: 'Error adding asset', severity: 'error' });
    }
  };

  const handleAddNote = async () => {
    try {
      await axios.post('/notes', { ...newNote, client_id: parseInt(id) });
      fetchNotes();
      setAddNoteDialog(false);
      setNewNote({ title: '', content: '', note_type: 'general' });
      setSnackbar({ open: true, message: 'Note added successfully', severity: 'success' });
    } catch (error) {
      console.error('Error adding note:', error);
      setSnackbar({ open: true, message: 'Error adding note', severity: 'error' });
    }
  };

  const handleAddCaseworker = async () => {
    try {
      await axios.post(`/clients/${id}/caseworkers`, newCaseworker);
      fetchCaseworkers();
      setAddCaseworkerDialog(false);
      setNewCaseworker({ name: '', role: '', email: '', phone: '' });
      setSnackbar({ open: true, message: 'Caseworker added successfully', severity: 'success' });
    } catch (error) {
      console.error('Error adding caseworker:', error);
      setSnackbar({ open: true, message: 'Error adding caseworker', severity: 'error' });
    }
  };

  const handleAddHouseholdMember = async () => {
    try {
      await axios.post(`/clients/${id}/household`, newHouseholdMember);
      fetchHouseholdMembers();
      setAddHouseholdDialog(false);
      setNewHouseholdMember({ name: '', relationship: '', age: '', dependent: false });
      setSnackbar({ open: true, message: 'Household member added successfully', severity: 'success' });
    } catch (error) {
      console.error('Error adding household member:', error);
      setSnackbar({ open: true, message: 'Error adding household member', severity: 'error' });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
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

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab icon={<AssessmentIcon />} label="Overview" />
          <Tab icon={<WorkIcon />} label="Case Details" />
          <Tab icon={<ChecklistIcon />} label="Compliance" />
          <Tab icon={<NoteIcon />} label="Case Notes" />
          <Tab icon={<PersonIcon />} label="Client/Household" />
          <Tab icon={<SupervisorIcon />} label="Caseworkers" />
          <Tab icon={<MoneyIcon />} label="Money" />
          <Tab icon={<MailIcon />} label="Letters" />
          <Tab icon={<FolderIcon />} label="Files" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Client Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Email</Typography>
                    <Typography variant="body1">{client.email || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Phone</Typography>
                    <Typography variant="body1">{client.phone || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">Address</Typography>
                    <Typography variant="body1">{client.address || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Cases</Typography>
                    <Typography variant="h6" color="primary">{cases.length}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Active Debts</Typography>
                    <Typography variant="h6" color="error">{debts.length}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Recent Activity</Typography>
                <List dense>
                  {cases.slice(0, 3).map((case_item) => (
                    <ListItem key={case_item.id} button onClick={() => navigate(`/cases/${case_item.id}`)}>
                      <ListItemIcon><WorkIcon /></ListItemIcon>
                      <ListItemText 
                        primary={`Case ${case_item.case_number}`}
                        secondary={`Status: ${case_item.status} - ${case_item.debt_stage || 'Not set'}`}
                      />
                    </ListItem>
                  ))}
                  {cases.length === 0 && (
                    <ListItem>
                      <ListItemText primary="No cases found" secondary="Click 'New Case' to create the first case" />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Case Details Tab */}
      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Cases ({cases.length})</Typography>
            {cases.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Case Number</TableCell>
                      <TableCell>Stage</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Total Debt</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cases.map((case_item) => (
                      <TableRow key={case_item.id}>
                        <TableCell>{case_item.case_number}</TableCell>
                        <TableCell>{case_item.debt_stage || 'Not set'}</TableCell>
                        <TableCell>
                          <Chip label={case_item.status} size="small" color={case_item.status === 'active' ? 'success' : 'default'} />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={case_item.priority} 
                            size="small"
                            color={case_item.priority === 'urgent' ? 'error' : case_item.priority === 'high' ? 'warning' : 'info'}
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(case_item.total_debt)}</TableCell>
                        <TableCell>{new Date(case_item.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button size="small" onClick={() => navigate(`/cases/${case_item.id}`)}>View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box textAlign="center" py={3}>
                <WorkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="textSecondary">No cases found for this client</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCaseDialog(true)} sx={{ mt: 2 }}>
                  Create First Case
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compliance Tab */}
      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>FCA Compliance & Checklists</Typography>
            <FCAComplianceChecklist 
              clientId={id}
              onUpdate={() => setSnackbar({ open: true, message: 'Compliance checklist updated', severity: 'success' })}
            />
          </CardContent>
        </Card>
      )}

      {/* Case Notes Tab */}
      {tabValue === 3 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Case Notes</Typography>
              <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddNoteDialog(true)}>
                Add Note
              </Button>
            </Box>
            <List>
              {notes.map((note) => (
                <React.Fragment key={note.id}>
                  <ListItem>
                    <ListItemIcon><NoteIcon /></ListItemIcon>
                    <ListItemText
                      primary={note.title || `${note.note_type} note`}
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>{note.content}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            By {note.author_name} on {new Date(note.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
              {notes.length === 0 && (
                <Typography variant="body2" color="textSecondary" textAlign="center" py={3}>
                  No notes available. Click "Add Note" to create the first note.
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Client/Household Details Tab */}
      {tabValue === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Personal Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Email</Typography>
                    <Typography variant="body1">{client.email || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Phone</Typography>
                    <Typography variant="body1">{client.phone || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">Address</Typography>
                    <Typography variant="body1">{client.address || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Date of Birth</Typography>
                    <Typography variant="body1">
                      {client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString() : 'Not provided'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Relationship Status</Typography>
                    <Typography variant="body1">{client.relationship_status || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Dependents</Typography>
                    <Typography variant="body1">{client.dependents || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Employment</Typography>
                    <Typography variant="body1">{client.employment_status || 'Not provided'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Household Members</Typography>
                  <Button startIcon={<AddIcon />} size="small" onClick={() => setAddHouseholdDialog(true)}>
                    Add Member
                  </Button>
                </Box>
                <List dense>
                  {householdMembers.map((member) => (
                    <ListItem key={member.id}>
                      <ListItemIcon><PersonIcon /></ListItemIcon>
                      <ListItemText
                        primary={member.name}
                        secondary={`${member.relationship} - Age: ${member.age} ${member.dependent ? '(Dependent)' : ''}`}
                      />
                    </ListItem>
                  ))}
                  {householdMembers.length === 0 && (
                    <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
                      No household members recorded
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Caseworkers Tab */}
      {tabValue === 5 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Assigned Caseworkers</Typography>
              <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddCaseworkerDialog(true)}>
                Add Caseworker
              </Button>
            </Box>
            <Grid container spacing={2}>
              {caseworkers.map((worker) => (
                <Grid item xs={12} md={6} key={worker.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6">{worker.name}</Typography>
                      <Typography variant="body2" color="textSecondary" gutterBottom>{worker.role}</Typography>
                      <Typography variant="body2">Email: {worker.email}</Typography>
                      <Typography variant="body2">Phone: {worker.phone}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {caseworkers.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary" textAlign="center" py={3}>
                    No caseworkers assigned
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Money Tab */}
      {tabValue === 6 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Income</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">Income Sources</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddIncomeDialog(true)}>Add</Button>
                </Box>
                <List dense>
                  {income.map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText
                        primary={`${item.source} - ${item.type}`}
                        secondary={`${formatCurrency(item.amount)} (${item.frequency})`}
                      />
                    </ListItem>
                  ))}
                  {income.length === 0 && (
                    <Typography variant="body2" color="textSecondary">No income sources recorded</Typography>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
            
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Expenditure</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">Monthly Expenses</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddExpenditureDialog(true)}>Add</Button>
                </Box>
                <List dense>
                  {expenditure.map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText
                        primary={`${item.category} - ${item.description}`}
                        secondary={`${formatCurrency(item.amount)} (${item.frequency})`}
                      />
                    </ListItem>
                  ))}
                  {expenditure.length === 0 && (
                    <Typography variant="body2" color="textSecondary">No expenditures recorded</Typography>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Debts</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">Outstanding Debts</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddDebtDialog(true)}>Add</Button>
                </Box>
                <List dense>
                  {debts.map((debt) => (
                    <ListItem key={debt.id}>
                      <ListItemText
                        primary={`${debt.creditor_name} - ${debt.debt_type}`}
                        secondary={`Balance: ${formatCurrency(debt.current_balance)} | Min Payment: ${formatCurrency(debt.minimum_payment)} ${debt.is_priority ? '(Priority)' : ''}`}
                      />
                    </ListItem>
                  ))}
                  {debts.length === 0 && (
                    <Typography variant="body2" color="textSecondary">No debts recorded</Typography>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
            
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Assets & Savings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">Assets</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddAssetDialog(true)}>Add</Button>
                </Box>
                <List dense>
                  {assets.map((asset) => (
                    <ListItem key={asset.id}>
                      <ListItemText
                        primary={`${asset.asset_type} - ${asset.description}`}
                        secondary={`Value: ${formatCurrency(asset.estimated_value)} ${asset.is_secured ? '(Secured)' : ''}`}
                      />
                    </ListItem>
                  ))}
                  {assets.length === 0 && (
                    <Typography variant="body2" color="textSecondary">No assets recorded</Typography>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      )}

      {/* Letters Tab */}
      {tabValue === 7 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Generated Letters</Typography>
              <Button startIcon={<AddIcon />} variant="contained">Generate Letter</Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Template</TableCell>
                    <TableCell>Recipient</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {letters.map((letter) => (
                    <TableRow key={letter.id}>
                      <TableCell>{new Date(letter.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{letter.template_name}</TableCell>
                      <TableCell>{letter.recipient}</TableCell>
                      <TableCell>
                        <Chip label={letter.status} size="small" />
                      </TableCell>
                      <TableCell>
                        <Button size="small" startIcon={<DownloadIcon />}>Download</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {letters.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
                          No letters generated yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Files Tab */}
      {tabValue === 8 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Document Upload</Typography>
                <DocumentUpload 
                  clientId={id}
                  onUploadComplete={() => {
                    fetchFiles();
                    setSnackbar({ open: true, message: 'Document uploaded successfully', severity: 'success' });
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Stored Documents</Typography>
                <List>
                  {files.map((file) => (
                    <ListItem 
                      key={file.id}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            size="small" 
                            startIcon={<DownloadIcon />}
                            onClick={() => window.open(`/api/files/download/${file.id}`, '_blank')}
                          >
                            Download
                          </Button>
                          <Button 
                            size="small" 
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => {
                              setFileToDelete(file);
                              setDeleteFileDialog(true);
                            }}
                          >
                            Delete
                          </Button>
                        </Box>
                      }
                    >
                      <ListItemIcon><FolderIcon /></ListItemIcon>
                      <ListItemText
                        primary={file.filename}
                        secondary={`Uploaded: ${new Date(file.uploaded_at).toLocaleDateString()} | Size: ${file.file_size}`}
                      />
                    </ListItem>
                  ))}
                  {files.length === 0 && (
                    <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
                      No files uploaded yet
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

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

      {/* Add Income Dialog */}
      <Dialog open={addIncomeDialog} onClose={() => setAddIncomeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Income Source</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Income Source"
                value={newIncome.source}
                onChange={(e) => setNewIncome({...newIncome, source: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount (£)"
                type="number"
                value={newIncome.amount}
                onChange={(e) => setNewIncome({...newIncome, amount: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Frequency"
                value={newIncome.frequency}
                onChange={(e) => setNewIncome({...newIncome, frequency: e.target.value})}
              >
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Type"
                value={newIncome.type}
                onChange={(e) => setNewIncome({...newIncome, type: e.target.value})}
              >
                <MenuItem value="employment">Employment</MenuItem>
                <MenuItem value="benefits">Benefits</MenuItem>
                <MenuItem value="pension">Pension</MenuItem>
                <MenuItem value="investment">Investment</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddIncomeDialog(false)}>Cancel</Button>
          <Button onClick={handleAddIncome} variant="contained">Add Income</Button>
        </DialogActions>
      </Dialog>

      {/* Add Expenditure Dialog */}
      <Dialog open={addExpenditureDialog} onClose={() => setAddExpenditureDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Expenditure</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Category"
                value={newExpenditure.category}
                onChange={(e) => setNewExpenditure({...newExpenditure, category: e.target.value})}
              >
                <MenuItem value="rent">Rent/Mortgage</MenuItem>
                <MenuItem value="utilities">Utilities</MenuItem>
                <MenuItem value="food">Food & Groceries</MenuItem>
                <MenuItem value="transport">Transport</MenuItem>
                <MenuItem value="insurance">Insurance</MenuItem>
                <MenuItem value="healthcare">Healthcare</MenuItem>
                <MenuItem value="clothing">Clothing</MenuItem>
                <MenuItem value="childcare">Childcare</MenuItem>
                <MenuItem value="entertainment">Entertainment</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newExpenditure.description}
                onChange={(e) => setNewExpenditure({...newExpenditure, description: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount (£)"
                type="number"
                value={newExpenditure.amount}
                onChange={(e) => setNewExpenditure({...newExpenditure, amount: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Frequency"
                value={newExpenditure.frequency}
                onChange={(e) => setNewExpenditure({...newExpenditure, frequency: e.target.value})}
              >
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddExpenditureDialog(false)}>Cancel</Button>
          <Button onClick={handleAddExpenditure} variant="contained">Add Expenditure</Button>
        </DialogActions>
      </Dialog>

      {/* Add Debt Dialog */}
      <Dialog open={addDebtDialog} onClose={() => setAddDebtDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Debt</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Creditor Name"
                value={newDebt.creditor_name}
                onChange={(e) => setNewDebt({...newDebt, creditor_name: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Debt Type"
                value={newDebt.debt_type}
                onChange={(e) => setNewDebt({...newDebt, debt_type: e.target.value})}
              >
                <MenuItem value="credit_card">Credit Card</MenuItem>
                <MenuItem value="loan">Loan</MenuItem>
                <MenuItem value="mortgage">Mortgage</MenuItem>
                <MenuItem value="utility">Utility</MenuItem>
                <MenuItem value="council_tax">Council Tax</MenuItem>
                <MenuItem value="overdraft">Overdraft</MenuItem>
                <MenuItem value="hire_purchase">Hire Purchase</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Current Balance (£)"
                type="number"
                value={newDebt.current_balance}
                onChange={(e) => setNewDebt({...newDebt, current_balance: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Minimum Payment (£)"
                type="number"
                value={newDebt.minimum_payment}
                onChange={(e) => setNewDebt({...newDebt, minimum_payment: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newDebt.is_priority}
                    onChange={(e) => setNewDebt({...newDebt, is_priority: e.target.checked})}
                  />
                }
                label="Priority Debt"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDebtDialog(false)}>Cancel</Button>
          <Button onClick={handleAddDebt} variant="contained">Add Debt</Button>
        </DialogActions>
      </Dialog>

      {/* Add Asset Dialog */}
      <Dialog open={addAssetDialog} onClose={() => setAddAssetDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Asset</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Asset Type"
                value={newAsset.asset_type}
                onChange={(e) => setNewAsset({...newAsset, asset_type: e.target.value})}
              >
                <MenuItem value="property">Property</MenuItem>
                <MenuItem value="vehicle">Vehicle</MenuItem>
                <MenuItem value="savings">Savings Account</MenuItem>
                <MenuItem value="investments">Investments</MenuItem>
                <MenuItem value="jewelry">Jewelry</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newAsset.description}
                onChange={(e) => setNewAsset({...newAsset, description: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Estimated Value (£)"
                type="number"
                value={newAsset.estimated_value}
                onChange={(e) => setNewAsset({...newAsset, estimated_value: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newAsset.is_secured}
                    onChange={(e) => setNewAsset({...newAsset, is_secured: e.target.checked})}
                  />
                }
                label="Secured Asset"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddAssetDialog(false)}>Cancel</Button>
          <Button onClick={handleAddAsset} variant="contained">Add Asset</Button>
        </DialogActions>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={addNoteDialog} onClose={() => setAddNoteDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Note</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Title (optional)"
                value={newNote.title}
                onChange={(e) => setNewNote({...newNote, title: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Note Type"
                value={newNote.note_type}
                onChange={(e) => setNewNote({...newNote, note_type: e.target.value})}
              >
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="phone_call">Phone Call</MenuItem>
                <MenuItem value="meeting">Meeting</MenuItem>
                <MenuItem value="action_required">Action Required</MenuItem>
                <MenuItem value="financial_assessment">Financial Assessment</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Note Content"
                multiline
                rows={4}
                value={newNote.content}
                onChange={(e) => setNewNote({...newNote, content: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddNoteDialog(false)}>Cancel</Button>
          <Button onClick={handleAddNote} variant="contained" disabled={!newNote.content}>
            Add Note
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Caseworker Dialog */}
      <Dialog open={addCaseworkerDialog} onClose={() => setAddCaseworkerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Caseworker</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={newCaseworker.name}
                onChange={(e) => setNewCaseworker({...newCaseworker, name: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Role"
                value={newCaseworker.role}
                onChange={(e) => setNewCaseworker({...newCaseworker, role: e.target.value})}
              >
                <MenuItem value="advisor">Debt Advisor</MenuItem>
                <MenuItem value="supervisor">Supervisor</MenuItem>
                <MenuItem value="specialist">Specialist</MenuItem>
                <MenuItem value="trainee">Trainee</MenuItem>
                <MenuItem value="volunteer">Volunteer</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newCaseworker.email}
                onChange={(e) => setNewCaseworker({...newCaseworker, email: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone"
                value={newCaseworker.phone}
                onChange={(e) => setNewCaseworker({...newCaseworker, phone: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCaseworkerDialog(false)}>Cancel</Button>
          <Button onClick={handleAddCaseworker} variant="contained">Add Caseworker</Button>
        </DialogActions>
      </Dialog>

      {/* Add Household Member Dialog */}
      <Dialog open={addHouseholdDialog} onClose={() => setAddHouseholdDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Household Member</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={newHouseholdMember.name}
                onChange={(e) => setNewHouseholdMember({...newHouseholdMember, name: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Relationship"
                value={newHouseholdMember.relationship}
                onChange={(e) => setNewHouseholdMember({...newHouseholdMember, relationship: e.target.value})}
              >
                <MenuItem value="spouse">Spouse/Partner</MenuItem>
                <MenuItem value="child">Child</MenuItem>
                <MenuItem value="parent">Parent</MenuItem>
                <MenuItem value="sibling">Sibling</MenuItem>
                <MenuItem value="relative">Other Relative</MenuItem>
                <MenuItem value="lodger">Lodger</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Age"
                type="number"
                value={newHouseholdMember.age}
                onChange={(e) => setNewHouseholdMember({...newHouseholdMember, age: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newHouseholdMember.dependent}
                    onChange={(e) => setNewHouseholdMember({...newHouseholdMember, dependent: e.target.checked})}
                  />
                }
                label="Dependent"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddHouseholdDialog(false)}>Cancel</Button>
          <Button onClick={handleAddHouseholdMember} variant="contained">Add Member</Button>
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Delete File Confirmation Dialog */}
      <Dialog open={deleteFileDialog} onClose={() => setDeleteFileDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{fileToDelete?.filename}"?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            This action cannot be undone. The file will be permanently removed from the system.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteFileDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteFile} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientDetail;

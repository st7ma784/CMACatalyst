import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider
} from '@mui/material';
import {
  Download as DownloadIcon,
  Add as AddIcon,
  Note as NoteIcon,
  AttachFile as AttachFileIcon,
  Mail as MailIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import axios from 'axios';

const CaseDetail = () => {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [letters, setLetters] = useState([]);
  const [debtRecommendations, setDebtRecommendations] = useState(null);
  
  // Dialog states
  const [assetDialog, setAssetDialog] = useState(false);
  const [debtDialog, setDebtDialog] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  const [appointmentDialog, setAppointmentDialog] = useState(false);
  
  // Form states
  const [newAsset, setNewAsset] = useState({
    asset_type: '',
    description: '',
    estimated_value: '',
    is_secured: false
  });
  const [newDebt, setNewDebt] = useState({
    creditor_name: '',
    debt_type: '',
    current_balance: '',
    minimum_payment: '',
    is_priority: false
  });
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    note_type: 'general'
  });

  useEffect(() => {
    fetchCaseData();
  }, [id]);

  useEffect(() => {
    if (tabValue === 1) fetchNotes();
    if (tabValue === 2) fetchFiles();
    if (tabValue === 3) fetchLetters();
    if (tabValue === 4) fetchDebtRecommendations();
  }, [tabValue, id]);

  const fetchCaseData = async () => {
    try {
      const response = await axios.get(`/cases/${id}`);
      setCaseData(response.data);
    } catch (error) {
      console.error('Error fetching case data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`/notes/case/${id}`);
      setNotes(response.data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`/files/case/${id}`);
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchLetters = async () => {
    try {
      const response = await axios.get(`/letters/case/${id}`);
      setLetters(response.data);
    } catch (error) {
      console.error('Error fetching letters:', error);
    }
  };

  const fetchDebtRecommendations = async () => {
    try {
      const response = await axios.get(`/debt-tools/recommendations/${id}`);
      setDebtRecommendations(response.data);
    } catch (error) {
      console.error('Error fetching debt recommendations:', error);
    }
  };

  const handleAddAsset = async () => {
    try {
      await axios.post(`/cases/${id}/assets`, newAsset);
      fetchCaseData();
      setAssetDialog(false);
      setNewAsset({ asset_type: '', description: '', estimated_value: '', is_secured: false });
    } catch (error) {
      console.error('Error adding asset:', error);
    }
  };

  const handleAddDebt = async () => {
    try {
      await axios.post(`/cases/${id}/debts`, newDebt);
      fetchCaseData();
      setDebtDialog(false);
      setNewDebt({ creditor_name: '', debt_type: '', current_balance: '', minimum_payment: '', is_priority: false });
    } catch (error) {
      console.error('Error adding debt:', error);
    }
  };

  const handleAddNote = async () => {
    try {
      await axios.post('/notes', { ...newNote, case_id: parseInt(id) });
      fetchNotes();
      setNoteDialog(false);
      setNewNote({ title: '', content: '', note_type: 'general' });
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const downloadFinancialStatement = async () => {
    try {
      const response = await axios.get(`/cases/${id}/financial-statement`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Financial_Statement_${caseData.case_number}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading financial statement:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  };

  if (loading) {
    return <Typography>Loading case details...</Typography>;
  }

  if (!caseData) {
    return <Typography>Case not found</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">
            {caseData.first_name} {caseData.last_name}
          </Typography>
          <Typography variant="h6" color="textSecondary">
            Case: {caseData.case_number}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={downloadFinancialStatement}
        >
          Financial Statement
        </Button>
      </Box>

      {/* Case Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Debt
              </Typography>
              <Typography variant="h5">
                {formatCurrency(caseData.total_debt)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Monthly Income
              </Typography>
              <Typography variant="h5">
                {formatCurrency(caseData.monthly_income)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Monthly Expenses
              </Typography>
              <Typography variant="h5">
                {formatCurrency(caseData.monthly_expenses)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Disposable Income
              </Typography>
              <Typography variant="h5" color={caseData.disposable_income >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(caseData.disposable_income)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Assets & Debts" />
          <Tab label="Notes" />
          <Tab label="Files" />
          <Tab label="Letters" />
          <Tab label="Debt Tools" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {/* Assets */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Assets</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setAssetDialog(true)}
                  >
                    Add Asset
                  </Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {caseData.assets?.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell>{asset.asset_type}</TableCell>
                          <TableCell>{asset.description}</TableCell>
                          <TableCell>{formatCurrency(asset.estimated_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Debts */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Debts</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setDebtDialog(true)}
                  >
                    Add Debt
                  </Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Creditor</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Balance</TableCell>
                        <TableCell>Priority</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {caseData.debts?.map((debt) => (
                        <TableRow key={debt.id}>
                          <TableCell>{debt.creditor_name}</TableCell>
                          <TableCell>{debt.debt_type}</TableCell>
                          <TableCell>{formatCurrency(debt.current_balance)}</TableCell>
                          <TableCell>
                            {debt.is_priority && (
                              <Chip label="Priority" size="small" color="error" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Case Notes</Typography>
              <Button
                startIcon={<NoteIcon />}
                onClick={() => setNoteDialog(true)}
              >
                Add Note
              </Button>
            </Box>
            <List>
              {notes.map((note) => (
                <React.Fragment key={note.id}>
                  <ListItem>
                    <ListItemText
                      primary={note.title || `${note.note_type} note`}
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {note.content}
                          </Typography>
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
            </List>
          </CardContent>
        </Card>
      )}

      {tabValue === 4 && debtRecommendations && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recommended Debt Solutions
            </Typography>
            <Grid container spacing={2}>
              {debtRecommendations.recommendations.map((tool) => (
                <Grid item xs={12} md={6} key={tool.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6">{tool.name}</Typography>
                        <Chip
                          label={tool.recommendation_level.replace('_', ' ')}
                          color={
                            tool.recommendation_level === 'highly_recommended' ? 'success' :
                            tool.recommendation_level === 'suitable' ? 'info' :
                            tool.recommendation_level === 'consider' ? 'warning' : 'default'
                          }
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary" paragraph>
                        {tool.description}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Suitability Score: {tool.suitability_score}%
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Pros:
                      </Typography>
                      <Typography variant="body2" paragraph>
                        {tool.pros}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Cons:
                      </Typography>
                      <Typography variant="body2">
                        {tool.cons}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Add Asset Dialog */}
      <Dialog open={assetDialog} onClose={() => setAssetDialog(false)} maxWidth="sm" fullWidth>
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
                <MenuItem value="savings">Savings</MenuItem>
                <MenuItem value="investments">Investments</MenuItem>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssetDialog(false)}>Cancel</Button>
          <Button onClick={handleAddAsset} variant="contained">Add Asset</Button>
        </DialogActions>
      </Dialog>

      {/* Add Debt Dialog */}
      <Dialog open={debtDialog} onClose={() => setDebtDialog(false)} maxWidth="sm" fullWidth>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDebtDialog(false)}>Cancel</Button>
          <Button onClick={handleAddDebt} variant="contained">Add Debt</Button>
        </DialogActions>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={noteDialog} onClose={() => setNoteDialog(false)} maxWidth="md" fullWidth>
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
          <Button onClick={() => setNoteDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddNote} 
            variant="contained"
            disabled={!newNote.content}
          >
            Add Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CaseDetail;

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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as TemplateIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const LetterTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    subject: '',
    content: '',
    variables: '',
    is_active: true
  });
  const { user } = useAuth();

  // Sample variables that can be used in templates
  const availableVariables = [
    '{{client_name}}',
    '{{client_address}}',
    '{{case_number}}',
    '{{advisor_name}}',
    '{{advisor_email}}',
    '{{advisor_phone}}',
    '{{centre_name}}',
    '{{centre_address}}',
    '{{date}}',
    '{{creditor_name}}',
    '{{debt_amount}}',
    '{{payment_offer}}'
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/api/letter-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to load letter templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category,
        subject: template.subject,
        content: template.content,
        variables: template.variables || '',
        is_active: template.is_active
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        category: 'general',
        subject: '',
        content: '',
        variables: '',
        is_active: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setPreviewDialog(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingTemplate) {
        await axios.put(`/api/letter-templates/${editingTemplate.id}`, formData);
      } else {
        await axios.post('/api/letter-templates', formData);
      }
      fetchTemplates();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving template:', error);
      setError('Failed to save template');
    }
  };

  const handleDelete = async (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await axios.delete(`/api/letter-templates/${templateId}`);
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
        setError('Failed to delete template');
      }
    }
  };

  const handleToggleActive = async (templateId, isActive) => {
    try {
      await axios.put(`/api/letter-templates/${templateId}`, { is_active: !isActive });
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template status:', error);
      setError('Failed to update template status');
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'debt_management': return 'primary';
      case 'payment_plan': return 'success';
      case 'legal': return 'error';
      case 'compliance': return 'warning';
      case 'general': return 'default';
      default: return 'default';
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('template-content');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.content;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newContent = before + variable + after;
      setFormData({ ...formData, content: newContent });
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading letter templates...</Typography>
      </Box>
    );
  }

  // Only allow managers to access this component
  if (user?.role !== 'manager') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Access denied. Only managers can manage letter templates.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Letter Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          New Template
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <TemplateIcon sx={{ mr: 1 }} />
            All Templates ({templates.length})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {template.name}
                      </Typography>
                      {template.description && (
                        <Typography variant="caption" color="text.secondary">
                          {template.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={template.category?.replace('_', ' ')} 
                        size="small" 
                        color={getCategoryColor(template.category)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {template.subject || 'No subject'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={template.is_active ? 'Active' : 'Inactive'} 
                        size="small" 
                        color={template.is_active ? 'success' : 'default'}
                        onClick={() => handleToggleActive(template.id, template.is_active)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(template.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton 
                          size="small" 
                          onClick={() => handlePreview(template)}
                          title="Preview"
                        >
                          <ViewIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(template)}
                          title="Edit"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDelete(template.id)}
                          title="Delete"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">No templates found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Template Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create New Template'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
              <Tab label="Basic Info" />
              <Tab label="Content" />
              <Tab label="Variables" />
            </Tabs>

            {/* Basic Info Tab */}
            {tabValue === 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Template Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={formData.category}
                      label="Category"
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <MenuItem value="general">General</MenuItem>
                      <MenuItem value="debt_management">Debt Management</MenuItem>
                      <MenuItem value="payment_plan">Payment Plan</MenuItem>
                      <MenuItem value="legal">Legal</MenuItem>
                      <MenuItem value="compliance">Compliance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Subject Line"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    helperText="You can use variables like {{client_name}} in the subject"
                  />
                </Grid>
              </Grid>
            )}

            {/* Content Tab */}
            {tabValue === 1 && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    id="template-content"
                    fullWidth
                    label="Template Content"
                    multiline
                    rows={15}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    helperText="Use variables like {{client_name}} to insert dynamic content"
                  />
                </Grid>
              </Grid>
            )}

            {/* Variables Tab */}
            {tabValue === 2 && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Available Variables</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableVariables.map((variable) => (
                      <Chip
                        key={variable}
                        label={variable}
                        onClick={() => insertVariable(variable)}
                        sx={{ cursor: 'pointer' }}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Variable Descriptions</Typography>
                  <Box sx={{ fontSize: '0.875rem' }}>
                    <Typography variant="body2"><strong>{{client_name}}</strong> - Client's full name</Typography>
                    <Typography variant="body2"><strong>{{client_address}}</strong> - Client's address</Typography>
                    <Typography variant="body2"><strong>{{case_number}}</strong> - Case reference number</Typography>
                    <Typography variant="body2"><strong>{{advisor_name}}</strong> - Advisor's name</Typography>
                    <Typography variant="body2"><strong>{{centre_name}}</strong> - Centre name</Typography>
                    <Typography variant="body2"><strong>{{date}}</strong> - Current date</Typography>
                    <Typography variant="body2"><strong>{{creditor_name}}</strong> - Creditor name</Typography>
                    <Typography variant="body2"><strong>{{debt_amount}}</strong> - Debt amount</Typography>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Template Preview: {previewTemplate?.name}
        </DialogTitle>
        <DialogContent>
          {previewTemplate && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>Subject:</Typography>
              <Typography variant="body1" sx={{ mb: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                {previewTemplate.subject}
              </Typography>
              
              <Typography variant="h6" sx={{ mb: 1 }}>Content:</Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {previewTemplate.content}
                </Typography>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LetterTemplates;

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
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  Badge,
  Paper,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  AutoFixHigh as AutoIcon,
  Assessment as AnalyticsIcon,
  Folder as FolderIcon,
  Event as EventIcon,
  Security as SecurityIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import axios from 'axios';

const WorkflowManager = () => {
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [n8nStatus, setN8nStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [setupDialog, setSetupDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setupStep, setSetupStep] = useState(0);

  useEffect(() => {
    fetchN8nStatus();
    fetchTemplates();
    fetchWorkflows();
  }, []);

  const fetchN8nStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/n8n/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setN8nStatus(response.data);
    } catch (error) {
      console.error('Error fetching n8n status:', error);
      setN8nStatus({ connected: false, error: error.message });
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/n8n/templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to load workflow templates');
    }
  };

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/n8n/workflows', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkflows(response.data.workflows || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/n8n/workflows/create', {
        template_id: selectedTemplate.id,
        workflow_name: workflowName || selectedTemplate.name
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccess('Workflow created successfully!');
        setCreateDialog(false);
        setWorkflowName('');
        setSelectedTemplate(null);
        fetchWorkflows();
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      setError(error.response?.data?.error || 'Failed to create workflow');
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Case Management': return <AutoIcon />;
      case 'Analytics': return <AnalyticsIcon />;
      case 'Document Management': return <FolderIcon />;
      case 'Communication': return <EventIcon />;
      case 'Compliance': return <SecurityIcon />;
      case 'Workforce Management': return <PeopleIcon />;
      default: return <SettingsIcon />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'error': return 'error';
      default: return 'warning';
    }
  };

  const getComplexityColor = (complexity) => {
    switch (complexity?.toLowerCase()) {
      case 'simple': return 'success';
      case 'medium': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  const renderSetupGuide = () => {
    const setupSteps = [
      {
        label: 'Install n8n',
        description: 'Install n8n automation platform on your server',
        content: (
          <Box>
            <Typography variant="body2" paragraph>
              n8n is required to run automated workflows. You can install it using:
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.100', fontFamily: 'monospace' }}>
              <Typography variant="body2">
                npm install n8n -g<br/>
                n8n start
              </Typography>
            </Paper>
            <Typography variant="body2" sx={{ mt: 2 }}>
              n8n will be available at http://localhost:5678
            </Typography>
          </Box>
        )
      },
      {
        label: 'Configure Environment',
        description: 'Set up environment variables for integration',
        content: (
          <Box>
            <Typography variant="body2" paragraph>
              Add these environment variables to your .env file:
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.100', fontFamily: 'monospace' }}>
              <Typography variant="body2">
                N8N_BASE_URL=http://localhost:5678<br/>
                N8N_API_KEY=your_api_key_here<br/>
                API_BASE_URL={window.location.origin}
              </Typography>
            </Paper>
          </Box>
        )
      },
      {
        label: 'Test Connection',
        description: 'Verify the connection between CMA and n8n',
        content: (
          <Box>
            <Typography variant="body2" paragraph>
              Once n8n is running, click "Test Connection" to verify integration:
            </Typography>
            <Button
              variant="outlined"
              onClick={fetchN8nStatus}
              startIcon={n8nStatus?.connected ? <CheckIcon /> : <ErrorIcon />}
              color={n8nStatus?.connected ? 'success' : 'error'}
            >
              {n8nStatus?.connected ? 'Connected' : 'Test Connection'}
            </Button>
            {n8nStatus && (
              <Alert severity={n8nStatus.connected ? 'success' : 'error'} sx={{ mt: 2 }}>
                {n8nStatus.connected 
                  ? 'Successfully connected to n8n!' 
                  : n8nStatus.suggestion || 'Connection failed'
                }
              </Alert>
            )}
          </Box>
        )
      },
      {
        label: 'Create Your First Workflow',
        description: 'Choose a template and create your first automated workflow',
        content: (
          <Box>
            <Typography variant="body2" paragraph>
              Select from our pre-built templates to get started quickly:
            </Typography>
            <Grid container spacing={2}>
              {templates.slice(0, 3).map((template) => (
                <Grid item xs={12} sm={4} key={template.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        {getCategoryIcon(template.category)}
                        <Typography variant="subtitle2" noWrap>
                          {template.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {template.frequency}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )
      }
    ];

    return (
      <Dialog 
        open={setupDialog} 
        onClose={() => setSetupDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Workflow Automation Setup Guide
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={setupStep} orientation="vertical">
            {setupSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {step.description}
                  </Typography>
                  {step.content}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setSetupStep(Math.min(index + 1, setupSteps.length - 1))}
                      disabled={index === setupSteps.length - 1}
                      sx={{ mr: 1 }}
                    >
                      {index === setupSteps.length - 1 ? 'Complete' : 'Next'}
                    </Button>
                    <Button
                      onClick={() => setSetupStep(Math.max(index - 1, 0))}
                      disabled={index === 0}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box className="fade-in" sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>
          Workflow Automation
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<InfoIcon />}
            onClick={() => setSetupDialog(true)}
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
            Setup Guide
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialog(true)}
            disabled={!n8nStatus?.connected}
            className="gradient-button"
            sx={{ textTransform: 'none' }}
          >
            Create Workflow
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* n8n Status Card */}
      <Card className="modern-card" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <Badge
                color={n8nStatus?.connected ? 'success' : 'error'}
                variant="dot"
                sx={{
                  '& .MuiBadge-badge': {
                    width: 12,
                    height: 12,
                    borderRadius: '50%'
                  }
                }}
              >
                <SettingsIcon color="action" />
              </Badge>
              <Box>
                <Typography variant="h6">
                  n8n Integration Status
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {n8nStatus?.connected 
                    ? 'Connected and ready for automation' 
                    : 'Setup required - click Setup Guide to get started'
                  }
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              {n8nStatus?.connected && (
                <Chip
                  icon={<CheckIcon />}
                  label="Connected"
                  color="success"
                  size="small"
                />
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={fetchN8nStatus}
              >
                Refresh
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Active Workflows */}
      {workflows.length > 0 && (
        <Card className="modern-card" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Active Workflows ({workflows.length})
            </Typography>
            <List>
              {workflows.map((workflow) => (
                <ListItem key={workflow.n8n_workflow_id} divider>
                  <ListItemText
                    primary={workflow.template_id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Created {new Date(workflow.created_at).toLocaleDateString()} by {workflow.first_name} {workflow.last_name}
                        </Typography>
                        {workflow.last_execution && (
                          <Typography variant="caption" color="text.secondary">
                            Last executed: {new Date(workflow.last_execution.startedAt).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={workflow.n8n_status}
                        color={getStatusColor(workflow.n8n_status)}
                        size="small"
                      />
                      <IconButton size="small">
                        <SettingsIcon />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Workflow Templates */}
      <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
        Available Workflow Templates
      </Typography>
      
      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card 
              className="modern-card"
              sx={{ 
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3
                }
              }}
              onClick={() => {
                setSelectedTemplate(template);
                setWorkflowName(template.name);
                setCreateDialog(true);
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getCategoryIcon(template.category)}
                    <Typography variant="h6" component="div">
                      {template.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={template.complexity}
                    color={getComplexityColor(template.complexity)}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" paragraph>
                  {template.description}
                </Typography>

                <Box mb={2}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {template.frequency}
                    </Typography>
                  </Box>
                  <Chip
                    label={template.category}
                    variant="outlined"
                    size="small"
                    sx={{ mr: 1 }}
                  />
                </Box>

                <Typography variant="subtitle2" gutterBottom>
                  Benefits:
                </Typography>
                <List dense>
                  {template.benefits.slice(0, 2).map((benefit, index) => (
                    <ListItem key={index} sx={{ py: 0, px: 0 }}>
                      <ListItemText 
                        primary={benefit}
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      />
                    </ListItem>
                  ))}
                  {template.benefits.length > 2 && (
                    <Typography variant="caption" color="primary">
                      +{template.benefits.length - 2} more benefits
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Workflow Dialog */}
      <Dialog 
        open={createDialog} 
        onClose={() => setCreateDialog(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          Create New Workflow
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedTemplate.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedTemplate.description}
              </Typography>
              
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  What this workflow will do:
                </Typography>
                <List dense>
                  {selectedTemplate.benefits.map((benefit, index) => (
                    <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                      <CheckIcon color="success" sx={{ fontSize: 16, mr: 1 }} />
                      <ListItemText 
                        primary={benefit}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <TextField
                fullWidth
                label="Workflow Name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                helperText="Give your workflow a descriptive name"
                margin="normal"
              />

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  This workflow will be created in n8n and activated automatically. 
                  You can modify it later in the n8n interface.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateWorkflow}
            disabled={!workflowName.trim() || !n8nStatus?.connected}
            className="gradient-button"
          >
            Create Workflow
          </Button>
        </DialogActions>
      </Dialog>

      {renderSetupGuide()}

      {loading && (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default WorkflowManager;
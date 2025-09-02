import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Check as CheckIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  VpnKey as KeyIcon
} from '@mui/icons-material';
import axios from 'axios';

const NetworkRegistration = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [centerData, setCenterData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    letterhead_address: '',
    letterhead_contact: ''
  });

  const [managerData, setManagerData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: ''
  });

  const steps = [
    {
      label: 'Center Information',
      description: 'Basic details about your center'
    },
    {
      label: 'Manager Account',
      description: 'Create the primary manager account'
    },
    {
      label: 'Review & Submit',
      description: 'Confirm your registration details'
    }
  ];

  const handleNext = () => {
    if (validateCurrentStep()) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setError('');
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setError('');
  };

  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0:
        if (!centerData.name || !centerData.email) {
          setError('Please fill in all required center information');
          return false;
        }
        break;
      case 1:
        if (!managerData.username || !managerData.email || !managerData.password || 
            !managerData.first_name || !managerData.last_name) {
          setError('Please fill in all required manager information');
          return false;
        }
        if (managerData.password !== managerData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        if (managerData.password.length < 8) {
          setError('Password must be at least 8 characters long');
          return false;
        }
        break;
      default:
        return true;
    }
    return true;
  };

  const handleSubmitRegistration = async () => {
    setLoading(true);
    try {
      // Create center and manager account
      const registrationData = {
        center: centerData,
        manager: {
          ...managerData,
          role: 'manager'
        }
      };

      await axios.post('/api/centres/register', registrationData);
      setSuccess('Center registration successful! Please contact an administrator to activate your account.');
      setActiveStep(3); // Move to success step
    } catch (error) {
      console.error('Registration error:', error);
      setError('Registration failed. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Center Name"
                value={centerData.name}
                onChange={(e) => setCenterData({ ...centerData, name: e.target.value })}
                required
                variant="outlined"
                helperText="The official name of your debt advice center"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={3}
                value={centerData.address}
                onChange={(e) => setCenterData({ ...centerData, address: e.target.value })}
                variant="outlined"
                helperText="Complete postal address of your center"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={centerData.phone}
                onChange={(e) => setCenterData({ ...centerData, phone: e.target.value })}
                variant="outlined"
                helperText="Main contact number"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={centerData.email}
                onChange={(e) => setCenterData({ ...centerData, email: e.target.value })}
                required
                variant="outlined"
                helperText="Primary email for official communications"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Letterhead Address"
                multiline
                rows={2}
                value={centerData.letterhead_address}
                onChange={(e) => setCenterData({ ...centerData, letterhead_address: e.target.value })}
                variant="outlined"
                helperText="Address to appear on official letters (can be different from main address)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Letterhead Contact"
                value={centerData.letterhead_contact}
                onChange={(e) => setCenterData({ ...centerData, letterhead_contact: e.target.value })}
                variant="outlined"
                helperText="Contact information to appear on letters"
              />
            </Grid>
          </Grid>
        );
      
      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                This will be the primary manager account for your center. The manager will have full administrative access.
              </Alert>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={managerData.first_name}
                onChange={(e) => setManagerData({ ...managerData, first_name: e.target.value })}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={managerData.last_name}
                onChange={(e) => setManagerData({ ...managerData, last_name: e.target.value })}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                value={managerData.username}
                onChange={(e) => setManagerData({ ...managerData, username: e.target.value })}
                required
                variant="outlined"
                helperText="This will be used to log into the system"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={managerData.email}
                onChange={(e) => setManagerData({ ...managerData, email: e.target.value })}
                required
                variant="outlined"
                helperText="Manager's email address for notifications"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={managerData.password}
                onChange={(e) => setManagerData({ ...managerData, password: e.target.value })}
                required
                variant="outlined"
                helperText="Minimum 8 characters"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Confirm Password"
                type="password"
                value={managerData.confirmPassword}
                onChange={(e) => setManagerData({ ...managerData, confirmPassword: e.target.value })}
                required
                variant="outlined"
                error={managerData.password !== managerData.confirmPassword && managerData.confirmPassword !== ''}
                helperText={managerData.password !== managerData.confirmPassword && managerData.confirmPassword !== '' ? 'Passwords do not match' : ''}
              />
            </Grid>
          </Grid>
        );
      
      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon color="primary" />
                    Center Information
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <BusinessIcon />
                      </ListItemIcon>
                      <ListItemText primary="Name" secondary={centerData.name} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <LocationIcon />
                      </ListItemIcon>
                      <ListItemText primary="Address" secondary={centerData.address || 'Not provided'} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <PhoneIcon />
                      </ListItemIcon>
                      <ListItemText primary="Phone" secondary={centerData.phone || 'Not provided'} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <EmailIcon />
                      </ListItemIcon>
                      <ListItemText primary="Email" secondary={centerData.email} />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AdminIcon color="secondary" />
                    Manager Account
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <PersonIcon />
                      </ListItemIcon>
                      <ListItemText primary="Name" secondary={`${managerData.first_name} ${managerData.last_name}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <PersonIcon />
                      </ListItemIcon>
                      <ListItemText primary="Username" secondary={managerData.username} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <EmailIcon />
                      </ListItemIcon>
                      <ListItemText primary="Email" secondary={managerData.email} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <KeyIcon />
                      </ListItemIcon>
                      <ListItemText primary="Password" secondary="••••••••" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>Important:</strong> After registration, your center will need to be activated by a system administrator before you can begin using the platform. You will receive an email confirmation once your account is active.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Box textAlign="center" py={4}>
            <Avatar sx={{ bgcolor: 'success.main', width: 64, height: 64, mx: 'auto', mb: 2 }}>
              <CheckIcon sx={{ fontSize: 32 }} />
            </Avatar>
            <Typography variant="h5" gutterBottom>
              Registration Submitted Successfully!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
              Your center registration has been submitted for review. A system administrator will review your application and activate your account within 1-2 business days.
            </Typography>
            <Alert severity="info" sx={{ maxWidth: 600, mx: 'auto' }}>
              You will receive an email confirmation at <strong>{managerData.email}</strong> once your account is activated.
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box className="fade-in" sx={{ p: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box textAlign="center" mb={4}>
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
          Join the Network
        </Typography>
        <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.8)', mb: 4 }}>
          Register your debt advice center to join our secure network platform
        </Typography>
      </Box>

      <Card className="modern-card" sx={{ maxWidth: 900, mx: 'auto' }}>
        <CardContent sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>
                  <Typography variant="h6">{step.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
                <StepContent>
                  {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {error}
                    </Alert>
                  )}
                  
                  {renderStepContent(index)}
                  
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      onClick={index === steps.length - 1 ? handleSubmitRegistration : handleNext}
                      sx={{ mr: 1 }}
                      disabled={loading}
                      className="gradient-button"
                    >
                      {index === steps.length - 1 ? 'Submit Registration' : 'Continue'}
                    </Button>
                    <Button
                      disabled={index === 0 || loading}
                      onClick={handleBack}
                      sx={{ mr: 1 }}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === 3 && (
            <Box textAlign="center" mt={3}>
              <Button
                variant="outlined"
                onClick={() => window.location.href = '/login'}
                sx={{ textTransform: 'none' }}
              >
                Return to Login
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <Box mt={4}>
        <Card variant="outlined" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              Network Security Features
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                    <CheckIcon />
                  </Avatar>
                  <Typography variant="body2" fontWeight={500}>Data Isolation</Typography>
                  <Typography variant="caption" color="text.secondary">Complete separation between centers</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                    <CheckIcon />
                  </Avatar>
                  <Typography variant="body2" fontWeight={500}>Role-Based Access</Typography>
                  <Typography variant="caption" color="text.secondary">Managers and advisors permissions</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                    <CheckIcon />
                  </Avatar>
                  <Typography variant="body2" fontWeight={500}>Secure Communications</Typography>
                  <Typography variant="caption" color="text.secondary">Encrypted data transmission</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                    <CheckIcon />
                  </Avatar>
                  <Typography variant="body2" fontWeight={500}>Audit Trails</Typography>
                  <Typography variant="caption" color="text.secondary">Complete activity logging</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default NetworkRegistration;

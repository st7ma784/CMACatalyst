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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Tab,
  Tabs,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Check as CheckIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import axios from 'axios';

const CenterManagement = () => {
  const [centers, setCenters] = useState([]);
  const [currentCenter, setCurrentCenter] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  
  // Dialog states
  const [centerDialog, setCenterDialog] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  
  // Form states
  const [centerForm, setCenterForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    letterhead_address: '',
    letterhead_contact: ''
  });
  
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'advisor'
  });

  const [registrationStep, setRegistrationStep] = useState(0);
  const [editingCenter, setEditingCenter] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchCurrentCenter();
    fetchCenterUsers();
  }, []);

  const fetchCurrentCenter = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/centres/current', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCurrentCenter(response.data);
    } catch (error) {
      console.error('Error fetching current center:', error);
      setError('Failed to load center information');
    } finally {
      setLoading(false);
    }
  };

  const fetchCenterUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load center staff');
    }
  };

  const handleUpdateCenter = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/centres/${currentCenter.id}`, centerForm, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchCurrentCenter();
      setCenterDialog(false);
      setError('');
    } catch (error) {
      console.error('Error updating center:', error);
      setError('Failed to update center information');
    }
  };

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/users', userForm, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchCenterUsers();
      setUserDialog(false);
      resetUserForm();
      setError('');
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const updateData = { ...userForm };
      if (!updateData.password) {
        delete updateData.password;
      }
      
      await axios.put(`/api/users/${editingUser.id}`, updateData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchCenterUsers();
      setUserDialog(false);
      resetUserForm();
      setError('');
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchCenterUsers();
        setError('');
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  const openCenterDialog = () => {
    setCenterForm({
      name: currentCenter?.name || '',
      address: currentCenter?.address || '',
      phone: currentCenter?.phone || '',
      email: currentCenter?.email || '',
      letterhead_address: currentCenter?.letterhead_address || '',
      letterhead_contact: currentCenter?.letterhead_contact || ''
    });
    setCenterDialog(true);
  };

  const openUserDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        username: user.username,
        email: user.email,
        password: '',
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      });
    } else {
      setEditingUser(null);
      resetUserForm();
    }
    setUserDialog(true);
  };

  const resetUserForm = () => {
    setUserForm({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'advisor'
    });
  };

  const getRoleIcon = (role) => {
    return role === 'manager' ? <AdminIcon color="primary" /> : <PersonIcon color="secondary" />;
  };

  const getRoleColor = (role) => {
    return role === 'manager' ? 'primary' : 'secondary';
  };

  if (loading) {
    return <Typography>Loading center management...</Typography>;
  }

  return (
    <Box className="fade-in" sx={{ p: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
            Center Management
          </Typography>
          <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Manage your center settings and staff members
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openUserDialog()}
          className="gradient-button"
          sx={{ textTransform: 'none', px: 3, py: 1.5 }}
        >
          Add Staff Member
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Center Information" />
          <Tab label="Staff Management" />
          <Tab label="Network Settings" />
        </Tabs>
      </Box>

      {/* Center Information Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card className="modern-card" sx={{ height: 'fit-content' }}>
              <CardContent sx={{ p: 4 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon /> Center Details
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={openCenterDialog}
                    sx={{ textTransform: 'none' }}
                  >
                    Edit Details
                  </Button>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Center Name
                      </Typography>
                      <Typography variant="h6">
                        {currentCenter?.name || 'Not set'}
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationIcon fontSize="small" /> Address
                      </Typography>
                      <Typography variant="body1">
                        {currentCenter?.address || 'Not set'}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={3}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon fontSize="small" /> Phone
                      </Typography>
                      <Typography variant="body1">
                        {currentCenter?.phone || 'Not set'}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={3}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon fontSize="small" /> Email
                      </Typography>
                      <Typography variant="body1">
                        {currentCenter?.email || 'Not set'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card className="modern-card" sx={{ height: 'fit-content' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon /> Quick Stats
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Total Staff</Typography>
                    <Chip label={users.length} color="primary" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Managers</Typography>
                    <Chip label={users.filter(u => u.role === 'manager').length} color="success" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Advisors</Typography>
                    <Chip label={users.filter(u => u.role === 'advisor').length} color="info" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Active Users</Typography>
                    <Chip label={users.filter(u => u.is_active).length} color="success" size="small" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Staff Management Tab */}
      {activeTab === 1 && (
        <Card className="modern-card">
          <CardContent sx={{ p: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">Center Staff</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openUserDialog()}
                className="gradient-button"
                sx={{ textTransform: 'none' }}
              >
                Add Staff Member
              </Button>
            </Box>

            <TableContainer component={Paper} className="modern-table">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Staff Member</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ bgcolor: getRoleColor(user.role) + '.main' }}>
                            {user.first_name[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight={500}>
                              {user.first_name} {user.last_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              @{user.username}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getRoleIcon(user.role)}
                          label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          color={getRoleColor(user.role)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? 'Active' : 'Inactive'}
                          color={user.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => openUserDialog(user)}
                          title="Edit user"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteUser(user.id)}
                          title="Delete user"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Network Settings Tab */}
      {activeTab === 2 && (
        <Card className="modern-card">
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Network Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This center is part of a secure network where data is isolated between centers. 
              Only members of your center can access your client data, cases, and appointments.
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Data Isolation:</strong> Your center's data is completely separate from other centers in the network. 
                Staff members can only see clients, cases, and appointments within their assigned center.
              </Typography>
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Center Security
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          <CheckIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary="Data Isolation Enabled"
                        secondary="Complete separation from other centers"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          <CheckIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary="Role-Based Access"
                        secondary="Managers and advisors have appropriate permissions"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          <CheckIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary="Secure Communications"
                        secondary="All data encrypted in transit and at rest"
                      />
                    </ListItem>
                  </List>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Center Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Center ID</Typography>
                      <Typography variant="body1">{currentCenter?.id}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Created</Typography>
                      <Typography variant="body1">
                        {currentCenter?.created_at ? new Date(currentCenter.created_at).toLocaleDateString() : 'N/A'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                      <Typography variant="body1">
                        {currentCenter?.updated_at ? new Date(currentCenter.updated_at).toLocaleDateString() : 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Center Edit Dialog */}
      <Dialog 
        open={centerDialog} 
        onClose={() => setCenterDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 }
        }}
      >
        <DialogTitle sx={{ pb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Edit Center Information
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Center Name"
                value={centerForm.name}
                onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={centerForm.address}
                onChange={(e) => setCenterForm({ ...centerForm, address: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={centerForm.phone}
                onChange={(e) => setCenterForm({ ...centerForm, phone: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={centerForm.email}
                onChange={(e) => setCenterForm({ ...centerForm, email: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Letterhead Address"
                multiline
                rows={2}
                value={centerForm.letterhead_address}
                onChange={(e) => setCenterForm({ ...centerForm, letterhead_address: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Letterhead Contact"
                value={centerForm.letterhead_contact}
                onChange={(e) => setCenterForm({ ...centerForm, letterhead_contact: e.target.value })}
                variant="outlined"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCenterDialog(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateCenter} 
            variant="contained" 
            className="gradient-button"
            sx={{ textTransform: 'none', px: 3 }}
          >
            Update Center
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Create/Edit Dialog */}
      <Dialog 
        open={userDialog} 
        onClose={() => setUserDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 }
        }}
      >
        <DialogTitle sx={{ pb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {editingUser ? 'Edit Staff Member' : 'Add New Staff Member'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={userForm.first_name}
                onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={userForm.last_name}
                onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required={!editingUser}
                helperText={editingUser ? "Leave blank to keep current password" : ""}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Role</InputLabel>
                <Select
                  value={userForm.role}
                  label="Role"
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <MenuItem value="advisor">
                    <Box display="flex" alignItems="center" gap={1}>
                      <PersonIcon />
                      Advisor
                    </Box>
                  </MenuItem>
                  <MenuItem value="manager">
                    <Box display="flex" alignItems="center" gap={1}>
                      <AdminIcon />
                      Manager
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setUserDialog(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button 
            onClick={editingUser ? handleUpdateUser : handleCreateUser}
            variant="contained"
            className="gradient-button"
            disabled={!userForm.first_name || !userForm.last_name || !userForm.username || !userForm.email || (!editingUser && !userForm.password)}
            sx={{ textTransform: 'none', px: 3 }}
          >
            {editingUser ? 'Update Staff Member' : 'Add Staff Member'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CenterManagement;

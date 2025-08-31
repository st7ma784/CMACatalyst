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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Avatar,
  Alert,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';

const StaffManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'advisor'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/users', newUser, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchUsers();
      setOpenDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const updateData = { ...newUser };
      if (!updateData.password) {
        delete updateData.password; // Don't update password if empty
      }
      
      await axios.put(`/api/users/${editingUser.id}`, updateData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchUsers();
      setOpenDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    // Check if this would leave no managers
    const currentUser = users.find(u => u.id === userId);
    const managers = users.filter(u => u.role === 'manager');
    
    if (currentUser.role === 'manager' && newRole !== 'manager' && managers.length === 1) {
      setError('Cannot change role: Centre must have at least one manager');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/users/${userId}`, { role: newRole }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchUsers();
      setError('');
    } catch (error) {
      console.error('Error updating role:', error);
      setError('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId) => {
    const userToDelete = users.find(u => u.id === userId);
    const managers = users.filter(u => u.role === 'manager');
    
    if (userToDelete.role === 'manager' && managers.length === 1) {
      setError('Cannot delete: Centre must have at least one manager');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchUsers();
        setError('');
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setNewUser({
      username: user.username,
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    });
    setOpenDialog(true);
  };

  const resetForm = () => {
    setNewUser({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'advisor'
    });
    setEditingUser(null);
    setError('');
  };

  const getRoleIcon = (role) => {
    return role === 'manager' ? <AdminIcon /> : <PersonIcon />;
  };

  const getRoleColor = (role) => {
    return role === 'manager' ? 'primary' : 'default';
  };

  if (loading) {
    return <Typography>Loading staff...</Typography>;
  }

  return (
    <Box className="fade-in" sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon /> Staff Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          className="gradient-button"
          sx={{ textTransform: 'none' }}
        >
          Add Staff Member
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card className="modern-card">
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon /> Centre Staff ({users.length})
          </Typography>
          
          <TableContainer component={Paper} className="modern-table">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Staff Member</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: getRoleColor(user.role) === 'primary' ? 'primary.main' : 'grey.500' }}>
                          {user.first_name[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {user.first_name} {user.last_name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            @{user.username}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={user.role === 'manager' && users.filter(u => u.role === 'manager').length === 1}
                        >
                          <MenuItem value="advisor">
                            <Box display="flex" alignItems="center" gap={1}>
                              <PersonIcon fontSize="small" />
                              Advisor
                            </Box>
                          </MenuItem>
                          <MenuItem value="manager">
                            <Box display="flex" alignItems="center" gap={1}>
                              <AdminIcon fontSize="small" />
                              Manager
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'Active' : 'Inactive'}
                        color={user.is_active ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(user)}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteUser(user.id)}
                        color="error"
                        disabled={user.role === 'manager' && users.filter(u => u.role === 'manager').length === 1}
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

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={() => { setOpenDialog(false); resetForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit Staff Member' : 'Add New Staff Member'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                required
                value={newUser.first_name}
                onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                required
                value={newUser.last_name}
                onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Username"
                required
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={editingUser ? "New Password (leave blank to keep current)" : "Password"}
                type="password"
                required={!editingUser}
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select
                  value={newUser.role}
                  label="Role"
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
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
        <DialogActions>
          <Button onClick={() => { setOpenDialog(false); resetForm(); }}>
            Cancel
          </Button>
          <Button 
            onClick={editingUser ? handleUpdateUser : handleCreateUser}
            variant="contained"
            disabled={!newUser.first_name || !newUser.last_name || !newUser.username || !newUser.email || (!editingUser && !newUser.password)}
            className="gradient-button"
          >
            {editingUser ? 'Update' : 'Create'} Staff Member
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StaffManagement;

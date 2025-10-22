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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userDialog, setUserDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    role: 'advisor'
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: 'error' };
    
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    
    if (strength < 40) return { strength, label: 'Weak', color: 'error' };
    if (strength < 70) return { strength, label: 'Medium', color: 'warning' };
    return { strength, label: 'Strong', color: 'success' };
  };

  const passwordStrength = getPasswordStrength(newUser.password);

  useEffect(() => {
    if (user?.role === 'manager') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    // Validate password match
    if (newUser.password !== newUser.confirmPassword) {
      setSnackbar({ open: true, message: 'Passwords do not match', severity: 'error' });
      return;
    }

    // Validate password strength
    if (passwordStrength.strength < 40) {
      setSnackbar({ open: true, message: 'Password is too weak. Use at least 8 characters with mixed case and numbers.', severity: 'error' });
      return;
    }

    try {
      const { confirmPassword, ...userData } = newUser;
      const response = await axios.post('/users', userData);
      setUsers([response.data.user, ...users]);
      setUserDialog(false);
      setNewUser({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        first_name: '',
        last_name: '',
        role: 'advisor'
      });
      setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
    } catch (error) {
      console.error('Error creating user:', error);
      const errorMsg = error.response?.data?.error || 'Error creating user';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    }
  };

  const handleUpdateUser = async () => {
    try {
      const response = await axios.put(`/users/${selectedUser.id}`, {
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        email: selectedUser.email,
        role: selectedUser.role,
        is_active: selectedUser.is_active
      });
      
      setUsers(users.map(u => u.id === selectedUser.id ? response.data.user : u));
      setEditDialog(false);
      setSelectedUser(null);
      setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error updating user:', error);
      const errorMsg = error.response?.data?.error || 'Error updating user';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    }
  };

  const handleToggleUserStatus = async (userId, isActive) => {
    try {
      await axios.put(`/users/${userId}`, { is_active: !isActive });
      fetchUsers();
      setSnackbar({ open: true, message: 'User status updated', severity: 'success' });
    } catch (error) {
      console.error('Error updating user status:', error);
      setSnackbar({ open: true, message: 'Error updating user status', severity: 'error' });
    }
  };

  if (user?.role !== 'manager') {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="textSecondary">
          Access Denied - Manager Role Required
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return <Typography>Loading users...</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">User Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUserDialog(true)}
        >
          Add User
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((userItem) => (
              <TableRow key={userItem.id}>
                <TableCell>
                  <Typography variant="subtitle2">
                    {userItem.first_name} {userItem.last_name}
                  </Typography>
                </TableCell>
                <TableCell>{userItem.username}</TableCell>
                <TableCell>{userItem.email}</TableCell>
                <TableCell>
                  <Chip
                    label={userItem.role}
                    size="small"
                    color={userItem.role === 'manager' ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userItem.is_active}
                        onChange={() => handleToggleUserStatus(userItem.id, userItem.is_active)}
                        size="small"
                      />
                    }
                    label={userItem.is_active ? 'Active' : 'Inactive'}
                  />
                </TableCell>
                <TableCell>
                  {new Date(userItem.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedUser(userItem);
                      setEditDialog(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add User Dialog */}
      <Dialog open={userDialog} onClose={() => setUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Username"
              required
              value={newUser.username}
              onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              helperText="Unique username for login"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              required
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              helperText="Valid email address"
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              required
              value={newUser.password}
              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              helperText="Minimum 8 characters, mix of uppercase, lowercase, numbers recommended"
            />
            {newUser.password && (
              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Typography variant="caption" color="textSecondary">
                    Password Strength:
                  </Typography>
                  <Typography variant="caption" color={`${passwordStrength.color}.main`} fontWeight="bold">
                    {passwordStrength.label}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={passwordStrength.strength} 
                  color={passwordStrength.color}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
            )}
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              required
              value={newUser.confirmPassword}
              onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
              error={newUser.confirmPassword && newUser.password !== newUser.confirmPassword}
              helperText={newUser.confirmPassword && newUser.password !== newUser.confirmPassword ? "Passwords don't match" : "Re-enter password"}
            />
            <TextField
              fullWidth
              label="First Name"
              required
              value={newUser.first_name}
              onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
            />
            <TextField
              fullWidth
              label="Last Name"
              required
              value={newUser.last_name}
              onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
            />
            <TextField
              fullWidth
              select
              label="Role"
              value={newUser.role}
              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
            >
              <MenuItem value="advisor">Advisor</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateUser} 
            variant="contained"
            disabled={
              !newUser.username || 
              !newUser.email || 
              !newUser.password || 
              !newUser.confirmPassword ||
              !newUser.first_name || 
              !newUser.last_name ||
              newUser.password !== newUser.confirmPassword ||
              passwordStrength.strength < 40
            }
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                label="First Name"
                value={selectedUser.first_name}
                onChange={(e) => setSelectedUser({...selectedUser, first_name: e.target.value})}
              />
              <TextField
                fullWidth
                label="Last Name"
                value={selectedUser.last_name}
                onChange={(e) => setSelectedUser({...selectedUser, last_name: e.target.value})}
              />
              <TextField
                fullWidth
                label="Email"
                value={selectedUser.email}
                onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
              />
              <TextField
                fullWidth
                select
                label="Role"
                value={selectedUser.role}
                onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
              >
                <MenuItem value="advisor">Advisor</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedUser.is_active}
                    onChange={(e) => setSelectedUser({...selectedUser, is_active: e.target.checked})}
                  />
                }
                label="Active User"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateUser} variant="contained">
            Update User
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
    </Box>
  );
};

export default UserManagement;

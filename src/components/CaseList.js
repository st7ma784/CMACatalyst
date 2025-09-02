import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const CaseList = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [advisors, setAdvisors] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
    fetchAdvisors();
  }, [search, statusFilter, advisorFilter]);

  const fetchCases = async () => {
    try {
      const response = await axios.get('/cases', {
        params: { 
          search, 
          status: statusFilter,
          advisor_id: advisorFilter,
          limit: 50 
        }
      });
      setCases(response.data);
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvisors = async () => {
    try {
      const response = await axios.get('/users');
      setAdvisors(response.data);
    } catch (error) {
      console.error('Error fetching advisors:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  };

  if (loading) {
    return <Typography>Loading cases...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cases
      </Typography>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            placeholder="Search by client name, case number, phone, email, NI number, or debt stage..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="on_hold">On Hold</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Advisor"
            value={advisorFilter}
            onChange={(e) => setAdvisorFilter(e.target.value)}
          >
            <MenuItem value="">All Advisors</MenuItem>
            {advisors.map((advisor) => (
              <MenuItem key={advisor.id} value={advisor.id}>
                {advisor.first_name} {advisor.last_name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Case Number</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Advisor</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>Total Debt</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((case_item) => (
              <TableRow key={case_item.id}>
                <TableCell>
                  <Typography variant="subtitle2">
                    {case_item.case_number}
                  </Typography>
                </TableCell>
                <TableCell>{case_item.client_name}</TableCell>
                <TableCell>{case_item.advisor_name || 'Unassigned'}</TableCell>
                <TableCell>{case_item.debt_stage || 'Not set'}</TableCell>
                <TableCell>{formatCurrency(case_item.total_debt)}</TableCell>
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
                <TableCell>
                  <Chip
                    label={case_item.status}
                    size="small"
                    color={
                      case_item.status === 'active' ? 'success' :
                      case_item.status === 'on_hold' ? 'warning' : 'default'
                    }
                  />
                </TableCell>
                <TableCell>
                  {new Date(case_item.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/cases/${case_item.id}`)}
                  >
                    <ViewIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CaseList;

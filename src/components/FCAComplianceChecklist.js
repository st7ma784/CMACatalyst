import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  TextField,
  Button,
  Chip,
  LinearProgress,
  Grid,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Info as InfoIcon,
  AttachFile as AttachFileIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const categoryColors = {
  data_protection: '#2563eb',
  complaints: '#7c3aed',
  advice_process: '#059669',
  documentation: '#d97706',
  monitoring: '#dc2626',
  quality: '#6366f1'
};

const categoryLabels = {
  data_protection: 'Data Protection',
  complaints: 'Complaints Procedure',
  advice_process: 'Advice Process',
  documentation: 'Documentation',
  monitoring: 'Monitoring',
  quality: 'Quality Assurance'
};

function FCAComplianceChecklist({ caseId, onUpdate }) {
  const { user } = useAuth();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [itemNotes, setItemNotes] = useState({});
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchChecklist();
  }, [caseId]);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/compliance/fca/case/${caseId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch compliance checklist');
      }

      const data = await response.json();
      setChecklist(data);
      
      // Initialize notes state
      const notes = {};
      Object.values(data.items_by_category).flat().forEach(item => {
        if (item.notes) {
          notes[item.id] = item.notes;
        }
      });
      setItemNotes(notes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleItemToggle = async (itemId, isCompleted) => {
    try {
      const response = await fetch(`/api/compliance/fca/case/${caseId}/item/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          is_completed: isCompleted,
          notes: itemNotes[itemId] || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update compliance item');
      }

      // Refresh checklist
      await fetchChecklist();
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNotesChange = (itemId, notes) => {
    setItemNotes(prev => ({
      ...prev,
      [itemId]: notes
    }));
  };

  const handleSaveNotes = async (itemId) => {
    try {
      const item = Object.values(checklist.items_by_category).flat().find(i => i.id === itemId);
      
      const response = await fetch(`/api/compliance/fca/case/${caseId}/item/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          is_completed: item.is_completed,
          notes: itemNotes[itemId] || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      await fetchChecklist();
    } catch (err) {
      setError(err.message);
    }
  };

  const getCompletionColor = (percentage) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 70) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>FCA Compliance Checklist</Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!checklist) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">FCA Compliance Checklist</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="View compliance details">
              <IconButton onClick={() => setShowDetails(true)} size="small">
                <InfoIcon />
              </IconButton>
            </Tooltip>
            <Chip
              label={`${checklist.statistics.completion_percentage}% Complete`}
              color={getCompletionColor(checklist.statistics.completion_percentage)}
              size="small"
            />
          </Box>
        </Box>

        <Box mb={2}>
          <LinearProgress
            variant="determinate"
            value={checklist.statistics.completion_percentage}
            color={getCompletionColor(checklist.statistics.completion_percentage)}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" color="text.secondary" mt={1}>
            {checklist.statistics.completed_items} of {checklist.statistics.total_items} items completed
            {checklist.statistics.mandatory_items > 0 && (
              <> • {checklist.statistics.completed_mandatory_items} of {checklist.statistics.mandatory_items} mandatory items</>
            )}
          </Typography>
        </Box>

        {Object.entries(checklist.items_by_category).map(([category, items]) => (
          <Accordion
            key={category}
            expanded={expandedCategory === category}
            onChange={(event, isExpanded) => setExpandedCategory(isExpanded ? category : null)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={2} width="100%">
                <Box
                  width={12}
                  height={12}
                  borderRadius="50%"
                  bgcolor={categoryColors[category]}
                />
                <Typography variant="subtitle1" fontWeight={600}>
                  {categoryLabels[category]}
                </Typography>
                <Chip
                  label={`${items.filter(item => item.is_completed).length}/${items.length}`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {items.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        bgcolor: item.is_completed ? 'success.50' : 'transparent',
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <ListItemIcon>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={item.is_completed || false}
                              onChange={(e) => handleItemToggle(item.id, e.target.checked)}
                              icon={<RadioButtonUncheckedIcon />}
                              checkedIcon={<CheckCircleIcon />}
                              color="success"
                            />
                          }
                          label=""
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography
                              variant="body1"
                              fontWeight={item.is_mandatory ? 600 : 400}
                              sx={{
                                textDecoration: item.is_completed ? 'line-through' : 'none',
                                color: item.is_completed ? 'text.secondary' : 'text.primary'
                              }}
                            >
                              {item.title}
                            </Typography>
                            {item.is_mandatory && (
                              <Chip label="Required" size="small" color="error" variant="outlined" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box mt={1}>
                            <Typography variant="body2" color="text.secondary" mb={1}>
                              {item.description}
                            </Typography>
                            
                            {item.is_completed && (
                              <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <PersonIcon fontSize="small" color="action" />
                                <Typography variant="caption">
                                  Completed by {item.completed_by_name} on{' '}
                                  {new Date(item.completed_at).toLocaleDateString()}
                                </Typography>
                              </Box>
                            )}

                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              placeholder="Add notes or evidence details..."
                              value={itemNotes[item.id] || ''}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                              onBlur={() => handleSaveNotes(item.id)}
                              size="small"
                              variant="outlined"
                              sx={{ mt: 1 }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < items.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}

        {checklist.statistics.completion_percentage < 100 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Complete all mandatory compliance items before progressing the case to closure.
              {checklist.statistics.mandatory_completion_percentage < 100 && (
                <> You still have {checklist.statistics.mandatory_items - checklist.statistics.completed_mandatory_items} mandatory items to complete.</>
              )}
            </Typography>
          </Alert>
        )}
      </CardContent>

      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>FCA Compliance Details</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Overall Progress</Typography>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Total Items: {checklist.statistics.total_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed: {checklist.statistics.completed_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completion Rate: {checklist.statistics.completion_percentage}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Mandatory Items</Typography>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Total Mandatory: {checklist.statistics.mandatory_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed: {checklist.statistics.completed_mandatory_items}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completion Rate: {checklist.statistics.mandatory_completion_percentage}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Category Breakdown</Typography>
              {Object.entries(checklist.items_by_category).map(([category, items]) => (
                <Box key={category} display="flex" alignItems="center" gap={2} mb={1}>
                  <Box
                    width={12}
                    height={12}
                    borderRadius="50%"
                    bgcolor={categoryColors[category]}
                  />
                  <Typography variant="body2" sx={{ minWidth: 150 }}>
                    {categoryLabels[category]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {items.filter(item => item.is_completed).length} / {items.length} completed
                  </Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default FCAComplianceChecklist;

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
  Divider,
  Paper
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  TrendingFlat as ArrowIcon,
  Description as DocumentIcon,
  Psychology as BrainIcon
} from '@mui/icons-material';
import axios from 'axios';

const ShouldIWorryDialog = ({ open, onClose, clientId, filename, documentSummary }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if (open && !analysis && !loading) {
      analyzeDocument();
    }
  }, [open]);

  const analyzeDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8104/should-i-worry', {
        client_id: clientId,
        filename: filename,
        document_summary: documentSummary
      });

      setAnalysis(response.data);
    } catch (err) {
      console.error('Error analyzing document:', err);
      setError(err.response?.data?.detail || 'Could not analyze document');
    } finally {
      setLoading(false);
    }
  };

  const getWorryColor = (level) => {
    switch (level) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      default:
        return 'default';
    }
  };

  const getWorryIcon = (level) => {
    switch (level) {
      case 'low':
        return <CheckCircleIcon />;
      case 'medium':
        return <WarningIcon />;
      case 'high':
        return <ErrorIcon />;
      default:
        return null;
    }
  };

  const getWorryMessage = (level) => {
    switch (level) {
      case 'low':
        return "Don't worry!";
      case 'medium':
        return 'Keep an eye on this';
      case 'high':
        return 'Important - Take action';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <BrainIcon color="primary" />
          <Typography variant="h6">Should I worry about this document?</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" mt={2}>
              Analyzing your document...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {analysis && !loading && (
          <Box>
            {/* Worry Level Badge */}
            <Box display="flex" justifyContent="center" mb={3}>
              <Chip
                icon={getWorryIcon(analysis.worry_level)}
                label={getWorryMessage(analysis.worry_level)}
                color={getWorryColor(analysis.worry_level)}
                size="large"
                sx={{ 
                  fontSize: '1.1rem', 
                  py: 3,
                  px: 2
                }}
              />
            </Box>

            {/* Reassurance Message */}
            <Paper elevation={0} sx={{ bgcolor: 'primary.50', p: 2, mb: 3, borderRadius: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.main', mb: 1 }}>
                Here's what you need to know:
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                {analysis.reassurance}
              </Typography>
            </Paper>

            {/* Context */}
            <Box mb={3}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowIcon color="primary" />
                Where this fits in your journey
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
                {analysis.context}
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Next Steps */}
            {analysis.next_steps && analysis.next_steps.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  Recommended next steps:
                </Typography>
                <List dense>
                  {analysis.next_steps.map((step, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Chip label={index + 1} color="primary" size="small" />
                      </ListItemIcon>
                      <ListItemText primary={step} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Related Documents */}
            {analysis.related_docs && analysis.related_docs.length > 0 && (
              <Box mb={2}>
                <Typography variant="h6" gutterBottom>
                  Related documents in your file:
                </Typography>
                <List dense>
                  {analysis.related_docs.map((doc, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <DocumentIcon color="action" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={doc}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Confidence Footer */}
            <Box mt={3} pt={2} borderTop={1} borderColor="divider">
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Analysis confidence: {analysis.confidence}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          Thanks, I understand
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShouldIWorryDialog;

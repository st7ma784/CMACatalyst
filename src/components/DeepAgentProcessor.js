import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Psychology as PsychologyIcon,
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import axios from 'axios';

const DeepAgentProcessor = ({ caseId, clientName, onResult }) => {
  const [clientInput, setClientInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const processCase = async () => {
    if (!clientInput.trim()) {
      setError('Please enter client input');
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/deepagent/process-case', {
        client_input: clientInput,
        case_id: caseId,
        client_name: clientName
      });

      if (response.data.success) {
        setResult(response.data.data);
        if (onResult) {
          onResult(response.data.data);
        }
      } else {
        setError(response.data.error || 'Processing failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Network error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const getRiskColor = (riskAssessment) => {
    if (riskAssessment?.includes('HIGH')) return 'error';
    if (riskAssessment?.includes('MEDIUM')) return 'warning';
    return 'success';
  };

  const getComplianceColor = (auditReport) => {
    if (auditReport?.includes('NEEDS IMPROVEMENT')) return 'error';
    if (auditReport?.includes('GOOD')) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h5" component="h2">
              DeepAgent AI Processor
            </Typography>
          </Box>

          {caseId && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Processing case: {caseId} {clientName && `for ${clientName}`}
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Client Input"
            placeholder="Enter what the client has told you about their situation..."
            value={clientInput}
            onChange={(e) => setClientInput(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            onClick={processCase}
            disabled={processing || !clientInput.trim()}
            startIcon={processing ? <CircularProgress size={20} /> : <PsychologyIcon />}
            sx={{ mb: 2 }}
          >
            {processing ? 'Processing with AI...' : 'Process with DeepAgent'}
          </Button>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {result && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <AssessmentIcon sx={{ mr: 1 }} />
                AI Analysis Results
              </Typography>

              {/* Risk Assessment */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <WarningIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Risk Assessment</Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <Chip
                        label={result.risk_assessment?.includes('HIGH') ? 'HIGH RISK' :
                               result.risk_assessment?.includes('MEDIUM') ? 'MEDIUM RISK' : 'LOW RISK'}
                        color={getRiskColor(result.risk_assessment)}
                        size="small"
                      />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {result.risk_assessment}
                  </Typography>
                </AccordionDetails>
              </Accordion>

              {/* AI Response */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PsychologyIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">AI Recommendations</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                    {result.agent_response}
                  </Typography>
                </AccordionDetails>
              </Accordion>

              {/* Compliance Audit */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <SecurityIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">FCA Compliance Audit</Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <Chip
                        label={result.audit_report?.includes('EXCELLENT') ? 'EXCELLENT' :
                               result.audit_report?.includes('GOOD') ? 'GOOD' : 'NEEDS REVIEW'}
                        color={getComplianceColor(result.audit_report)}
                        size="small"
                      />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {result.audit_report}
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Processed: {new Date(result.timestamp).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {result.status}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DeepAgentProcessor;

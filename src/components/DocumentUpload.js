import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Grid
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  CheckCircle,
  Error,
  Delete,
  Visibility,
  Edit,
  Refresh,
  Check as CheckIcon,
  Warning as WarningIcon,
  SmartToy as AIIcon,
  Psychology as WorryIcon
} from '@mui/icons-material';
import axios from 'axios';
import FileTreeViewer from './FileTreeViewer';
import ShouldIWorryDialog from './ShouldIWorryDialog';

const DocumentUpload = ({ caseId, onUploadComplete }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [ocrResults, setOcrResults] = useState({});
  const [approvalDialog, setApprovalDialog] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [worryDialog, setWorryDialog] = useState({ open: false, filename: null, summary: null });

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
      ocrResult: null,
      classification: null
    }));
    setFiles(prev => [...prev, ...newFiles]);
    
    // Start processing files
    newFiles.forEach(fileObj => processFile(fileObj));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const processFile = async (fileObj) => {
    try {
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: 'uploading', progress: 25 } : f
      ));

      // Upload file
      const formData = new FormData();
      formData.append('file', fileObj.file);
      formData.append('caseId', caseId);

      const uploadResponse = await axios.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setFiles(prev => prev.map(f => 
            f.id === fileObj.id ? { ...f, progress: progress } : f
          ));
        }
      });

      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: 'processing', progress: 50 } : f
      ));

      // Process with OCR
      const ocrResponse = await axios.post('/api/documents/process-ocr', {
        fileId: uploadResponse.data.fileId,
        caseId: caseId
      });

      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { 
          ...f, 
          status: 'completed', 
          progress: 100,
          ocrResult: ocrResponse.data,
          fileId: uploadResponse.data.fileId
        } : f
      ));

      // Show approval dialog if classification requires it
      if (ocrResponse.data.requiresApproval) {
        setApprovalDialog({
          fileId: uploadResponse.data.fileId,
          fileName: fileObj.file.name,
          ...ocrResponse.data
        });
      }

    } catch (error) {
      console.error('File processing error:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: 'error', progress: 0 } : f
      ));
      setSnackbar({
        open: true,
        message: `Error processing ${fileObj.file.name}: ${error.response?.data?.message || error.message}`,
        severity: 'error'
      });
    }
  };

  const handleApproval = async (approved, overrides = {}) => {
    try {
      await axios.post('/api/documents/approve-classification', {
        fileId: approvalDialog.fileId,
        approved,
        overrides,
        caseId
      });

      setSnackbar({
        open: true,
        message: approved ? 'Document classification approved' : 'Document classification updated',
        severity: 'success'
      });

      setApprovalDialog(null);
      if (onUploadComplete) onUploadComplete();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error saving classification',
        severity: 'error'
      });
    }
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'error': return 'error';
      case 'processing': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckIcon />;
      case 'error': return <WarningIcon />;
      case 'processing': return <AIIcon />;
      default: return null;
    }
  };

  const getClassificationColor = (confidence) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Upload Documents
          </Typography>
          <Paper
            {...getRootProps()}
            sx={{
              p: 3,
              textAlign: 'center',
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              mb: 2
            }}
          >
            <input {...getInputProps()} />
            <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              or click to select files
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supported formats: PDF, DOC, DOCX, JPG, PNG
            </Typography>
          </Paper>

          {/* Upload Progress */}
          {files.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Processing Documents
              </Typography>
              <List>
                {files.map((fileObj) => (
                  <ListItem key={fileObj.id} divider>
                    <ListItemIcon>
                      {getStatusIcon(fileObj.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={fileObj.file.name}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {(fileObj.file.size / 1024 / 1024).toFixed(2)} MB
                          </Typography>
                          {fileObj.status === 'processing' && (
                            <LinearProgress 
                              variant="determinate" 
                              value={fileObj.progress} 
                              sx={{ mt: 1 }}
                            />
                          )}
                          {fileObj.ocrResult && (
                            <Box sx={{ mt: 1 }}>
                              <Chip 
                                label={fileObj.ocrResult.classification?.type || 'Unknown'}
                                size="small"
                                color={getClassificationColor(fileObj.ocrResult.classification?.confidence)}
                              />
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {fileObj.status === 'completed' && fileObj.ocrResult && (
                        <>
                          <IconButton 
                            onClick={() => setWorryDialog({ 
                              open: true, 
                              filename: fileObj.file.name,
                              summary: fileObj.ocrResult.text?.substring(0, 500)
                            })}
                            color="secondary"
                            title="Should I worry about this?"
                          >
                            <WorryIcon />
                          </IconButton>
                          <IconButton onClick={() => setApprovalDialog(fileObj)}>
                            <Visibility />
                          </IconButton>
                          <IconButton onClick={() => handleApproval(fileObj.id, fileObj.ocrResult.classification)}>
                            <Edit />
                          </IconButton>
                        </>
                      )}
                      <IconButton onClick={() => removeFile(fileObj.id)}>
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      </Grid>

      <Grid item xs={12} md={6}>
        <FileTreeViewer 
          caseId={caseId} 
          refreshTrigger={refreshTrigger}
          onFileSelect={(file) => console.log('Selected file:', file)}
        />
      </Grid>

      {/* Approval Dialog */}
      <Dialog open={!!approvalDialog} onClose={() => setApprovalDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>Review Document Classification</DialogTitle>
        <DialogContent>
          {approvalDialog && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {approvalDialog.file.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                OCR Results and Classification
              </Typography>
              {approvalDialog.ocrResult && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Detected Text:</Typography>
                  <Typography variant="body2" sx={{ mt: 1, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    {approvalDialog.ocrResult.text?.substring(0, 500)}...
                  </Typography>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>Classification:</Typography>
                  <Chip 
                    label={approvalDialog.ocrResult.classification?.type || 'Unknown'}
                    color={approvalDialog.ocrResult.confidence > 0.8 ? 'success' : 'warning'}
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Confidence: {Math.round(approvalDialog.ocrResult.confidence * 100)}%
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog(null)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => handleApproval(approvalDialog?.id, approvalDialog?.ocrResult?.classification)}
          >
            Approve Classification
          </Button>
        </DialogActions>
      </Dialog>

      {/* Should I Worry Dialog */}
      <ShouldIWorryDialog
        open={worryDialog.open}
        onClose={() => setWorryDialog({ open: false, filename: null, summary: null })}
        clientId={caseId}
        filename={worryDialog.filename}
        documentSummary={worryDialog.summary}
      />
    </Grid>
  );
};

export default DocumentUpload;

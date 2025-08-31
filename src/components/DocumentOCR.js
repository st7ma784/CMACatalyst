import React, { useState, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    Grid,
    Chip,
    Alert,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Checkbox,
    FormControlLabel,
    Divider
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Description as DocumentIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Visibility as ViewIcon,
    AutoFixHigh as AutoIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const DocumentOCR = ({ caseId, onDocumentProcessed }) => {
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [processedDocument, setProcessedDocument] = useState(null);
    const [suggestionsDialogOpen, setSuggestionsDialogOpen] = useState(false);
    const [selectedSuggestions, setSelectedSuggestions] = useState({});
    const [error, setError] = useState(null);

    const onDrop = useCallback(async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        setProcessing(true);
        setError(null);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('document', file);
        formData.append('caseId', caseId);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/document-ocr/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setUploadProgress(percentCompleted);
                }
            });

            setProcessedDocument(response.data);
            
            // Initialize suggestions selection
            const initialSelections = {};
            response.data.autoPopulationSuggestions?.forEach((suggestion, index) => {
                initialSelections[index] = false;
            });
            setSelectedSuggestions(initialSelections);

            if (response.data.autoPopulationSuggestions?.length > 0) {
                setSuggestionsDialogOpen(true);
            }

            if (onDocumentProcessed) {
                onDocumentProcessed(response.data);
            }

        } catch (error) {
            console.error('Document upload error:', error);
            setError(error.response?.data?.error || 'Failed to process document');
        } finally {
            setProcessing(false);
            setUploadProgress(0);
        }
    }, [caseId, onDocumentProcessed]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.tiff'],
            'application/pdf': ['.pdf']
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024 // 10MB
    });

    const handleApplySuggestions = async () => {
        try {
            const suggestionsToApply = processedDocument.autoPopulationSuggestions
                .map((suggestion, index) => ({
                    ...suggestion,
                    apply: selectedSuggestions[index]
                }))
                .filter(suggestion => suggestion.apply);

            if (suggestionsToApply.length === 0) {
                setSuggestionsDialogOpen(false);
                return;
            }

            const token = localStorage.getItem('token');
            await axios.post('/api/document-ocr/apply-suggestions', {
                caseId,
                suggestions: suggestionsToApply
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuggestionsDialogOpen(false);
            // Show success message or refresh case data
            
        } catch (error) {
            console.error('Apply suggestions error:', error);
            setError('Failed to apply suggestions');
        }
    };

    const getDocumentTypeColor = (type) => {
        const colors = {
            'bank_statement': 'primary',
            'benefit_letter': 'success',
            'court_order': 'error',
            'utility_bill': 'warning',
            'employment_document': 'info',
            'credit_report': 'secondary',
            'other': 'default'
        };
        return colors[type] || 'default';
    };

    const getDocumentTypeLabel = (type) => {
        const labels = {
            'bank_statement': 'Bank Statement',
            'benefit_letter': 'Benefit Letter',
            'court_order': 'Court Order',
            'utility_bill': 'Utility Bill',
            'employment_document': 'Employment Document',
            'credit_report': 'Credit Report',
            'other': 'Other Document'
        };
        return labels[type] || 'Unknown';
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.8) return 'success';
        if (confidence >= 0.6) return 'warning';
        return 'error';
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Document Scanner & OCR
            </Typography>

            {/* Upload Area */}
            <Paper
                {...getRootProps()}
                sx={{
                    p: 4,
                    mb: 3,
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                }}
            >
                <input {...getInputProps()} />
                <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                    {isDragActive ? 'Drop document here' : 'Upload Document for OCR Processing'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Drag & drop or click to select files (PDF, JPG, PNG, TIFF)
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Maximum file size: 10MB
                </Typography>
            </Paper>

            {/* Processing Progress */}
            {processing && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Processing Document...
                        </Typography>
                        <LinearProgress 
                            variant="determinate" 
                            value={uploadProgress} 
                            sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            {uploadProgress < 100 ? 'Uploading...' : 'Running OCR analysis...'}
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* Error Display */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Processing Results */}
            {processedDocument && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item>
                                <DocumentIcon color="primary" />
                            </Grid>
                            <Grid item xs>
                                <Typography variant="h6">
                                    Document Processed Successfully
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                    <Chip
                                        label={getDocumentTypeLabel(processedDocument.documentType)}
                                        color={getDocumentTypeColor(processedDocument.documentType)}
                                        size="small"
                                        sx={{ mr: 1 }}
                                    />
                                    <Chip
                                        label={`${Math.round(processedDocument.confidence * 100)}% Confidence`}
                                        color={getConfidenceColor(processedDocument.confidence)}
                                        size="small"
                                        icon={<CheckIcon />}
                                    />
                                </Box>
                            </Grid>
                            <Grid item>
                                <Button
                                    variant="outlined"
                                    startIcon={<ViewIcon />}
                                    onClick={() => {
                                        // Show extracted data details
                                        console.log('Extracted data:', processedDocument.extractedData);
                                    }}
                                >
                                    View Details
                                </Button>
                            </Grid>
                        </Grid>

                        {/* Extracted Data Summary */}
                        {processedDocument.extractedData && Object.keys(processedDocument.extractedData).length > 0 && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Extracted Information:
                                </Typography>
                                <Grid container spacing={1}>
                                    {Object.entries(processedDocument.extractedData).map(([key, value]) => (
                                        <Grid item xs={12} sm={6} key={key}>
                                            <Typography variant="body2">
                                                <strong>{key.replace(/_/g, ' ').toUpperCase()}:</strong> {
                                                    typeof value === 'object' ? JSON.stringify(value) : String(value)
                                                }
                                            </Typography>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Auto-Population Suggestions Dialog */}
            <Dialog 
                open={suggestionsDialogOpen} 
                onClose={() => setSuggestionsDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AutoIcon sx={{ mr: 1 }} />
                        Auto-Population Suggestions
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        The following data was extracted from your document. Select which fields you'd like to automatically populate in the case.
                    </Alert>

                    <List>
                        {processedDocument?.autoPopulationSuggestions?.map((suggestion, index) => (
                            <React.Fragment key={index}>
                                <ListItem>
                                    <ListItemIcon>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={selectedSuggestions[index] || false}
                                                    onChange={(e) => setSelectedSuggestions({
                                                        ...selectedSuggestions,
                                                        [index]: e.target.checked
                                                    })}
                                                />
                                            }
                                            label=""
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={suggestion.field.replace(/_/g, ' ').toUpperCase()}
                                        secondary={
                                            <Box>
                                                <Typography variant="body2">
                                                    Value: <strong>£{suggestion.value}</strong>
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Confidence: {Math.round(suggestion.confidence * 100)}%
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                                {index < processedDocument.autoPopulationSuggestions.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSuggestionsDialogOpen(false)}>
                        Skip
                    </Button>
                    <Button 
                        onClick={handleApplySuggestions}
                        variant="contained"
                        disabled={Object.values(selectedSuggestions).every(v => !v)}
                    >
                        Apply Selected ({Object.values(selectedSuggestions).filter(v => v).length})
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DocumentOCR;

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
  Paper,
  Avatar,
  IconButton,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Palette as PaletteIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Code as SvgIcon
} from '@mui/icons-material';
import axios from 'axios';

const BrandingManagement = () => {
  const [centre, setCentre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadType, setUploadType] = useState('logo');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [letterheadData, setLetterheadData] = useState({
    letterhead_address: '',
    letterhead_contact: ''
  });

  useEffect(() => {
    fetchCentreData();
  }, []);

  const fetchCentreData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/centres/current', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCentre(response.data);
      setLetterheadData({
        letterhead_address: response.data.letterhead_address || '',
        letterhead_contact: response.data.letterhead_contact || ''
      });
    } catch (error) {
      console.error('Error fetching centre data:', error);
      setError('Failed to load centre information');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = {
      logo: ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'application/pdf'],
      letterhead: ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'application/pdf']
    };

    if (!allowedTypes[uploadType].includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, SVG, or PDF files.');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size too large. Please upload files smaller than 5MB.');
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', uploadType);

      await axios.post('/api/centres/upload-branding', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess(`${uploadType} uploaded successfully!`);
      setUploadDialog(false);
      setSelectedFile(null);
      fetchCentreData();
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    }
  };

  const handleDeleteBranding = async (type) => {
    if (!window.confirm(`Are you sure you want to delete the ${type}?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/centres/branding/${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setSuccess(`${type} deleted successfully!`);
      fetchCentreData();
    } catch (error) {
      console.error('Error deleting branding:', error);
      setError(`Failed to delete ${type}`);
    }
  };

  const handleLetterheadUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/centres/letterhead', letterheadData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setSuccess('Letterhead information updated successfully!');
      fetchCentreData();
    } catch (error) {
      console.error('Error updating letterhead:', error);
      setError('Failed to update letterhead information');
    }
  };

  const getFileIcon = (filename) => {
    if (!filename) return <ImageIcon />;
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf': return <PdfIcon />;
      case 'svg': return <SvgIcon />;
      default: return <ImageIcon />;
    }
  };

  const getFileTypeChip = (filename) => {
    if (!filename) return null;
    const ext = filename.toLowerCase().split('.').pop();
    const colors = {
      pdf: 'error',
      svg: 'success',
      jpg: 'primary',
      jpeg: 'primary',
      png: 'primary'
    };
    return <Chip label={ext.toUpperCase()} size="small" color={colors[ext] || 'default'} />;
  };

  if (loading) {
    return <Typography>Loading branding settings...</Typography>;
  }

  return (
    <Box className="fade-in" sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteIcon /> Branding & Letterhead
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Logo Management */}
        <Grid item xs={12} md={6}>
          <Card className="modern-card">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon /> Centre Logo
              </Typography>
              
              {centre?.letterhead_logo ? (
                <Box>
                  <Paper sx={{ p: 2, mb: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <img 
                      src={`data:image/png;base64,${centre.letterhead_logo}`}
                      alt="Centre Logo"
                      style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain' }}
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.target.style.display = 'none';
                      }}
                    />
                  </Paper>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Current Logo
                      </Typography>
                      {getFileTypeChip(centre.logo_filename)}
                    </Box>
                    <Box>
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteBranding('logo')}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'grey.300', width: 80, height: 80 }}>
                    <ImageIcon sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography variant="body2" color="textSecondary" mb={2}>
                    No logo uploaded
                  </Typography>
                </Box>
              )}

              <Button
                fullWidth
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => {
                  setUploadType('logo');
                  setUploadDialog(true);
                }}
                className="gradient-button"
                sx={{ textTransform: 'none' }}
              >
                {centre?.letterhead_logo ? 'Replace Logo' : 'Upload Logo'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Letterhead Template */}
        <Grid item xs={12} md={6}>
          <Card className="modern-card">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PdfIcon /> Letterhead Template
              </Typography>
              
              {centre?.letterhead_template ? (
                <Box>
                  <Paper sx={{ p: 2, mb: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      {getFileIcon(centre.letterhead_filename)}
                      <Typography variant="body1">
                        {centre.letterhead_filename || 'Letterhead Template'}
                      </Typography>
                    </Box>
                  </Paper>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Current Template
                      </Typography>
                      {getFileTypeChip(centre.letterhead_filename)}
                    </Box>
                    <Box>
                      <IconButton 
                        color="primary" 
                        onClick={() => window.open(`/api/centres/letterhead-download`, '_blank')}
                        size="small"
                        sx={{ mr: 1 }}
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteBranding('letterhead')}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'grey.300', width: 80, height: 80 }}>
                    <PdfIcon sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography variant="body2" color="textSecondary" mb={2}>
                    No letterhead template uploaded
                  </Typography>
                </Box>
              )}

              <Button
                fullWidth
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => {
                  setUploadType('letterhead');
                  setUploadDialog(true);
                }}
                className="gradient-button"
                sx={{ textTransform: 'none' }}
              >
                {centre?.letterhead_template ? 'Replace Template' : 'Upload Template'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Letterhead Information */}
        <Grid item xs={12}>
          <Card className="modern-card">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Letterhead Information
              </Typography>
              <Typography variant="body2" color="textSecondary" mb={3}>
                This information will be used in generated letters and documents.
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Letterhead Address"
                    multiline
                    rows={4}
                    value={letterheadData.letterhead_address}
                    onChange={(e) => setLetterheadData({
                      ...letterheadData,
                      letterhead_address: e.target.value
                    })}
                    placeholder="123 High Street&#10;London SW1A 1AA&#10;Tel: 020 7123 4567"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Information"
                    multiline
                    rows={4}
                    value={letterheadData.letterhead_contact}
                    onChange={(e) => setLetterheadData({
                      ...letterheadData,
                      letterhead_contact: e.target.value
                    })}
                    placeholder="For enquiries contact: info@centre.org.uk&#10;Website: www.centre.org.uk"
                  />
                </Grid>
              </Grid>

              <Box mt={3}>
                <Button
                  variant="contained"
                  onClick={handleLetterheadUpdate}
                  className="gradient-button"
                  sx={{ textTransform: 'none' }}
                >
                  Update Letterhead Information
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Upload {uploadType === 'logo' ? 'Logo' : 'Letterhead Template'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary" mb={2}>
              Supported formats: JPG, PNG, SVG, PDF (max 5MB)
            </Typography>
            
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.svg,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                fullWidth
                startIcon={<UploadIcon />}
                sx={{ mb: 2, py: 2 }}
              >
                Choose File
              </Button>
            </label>

            {selectedFile && (
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Box display="flex" alignItems="center" gap={2}>
                  {getFileIcon(selectedFile.name)}
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight="bold">
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                  {getFileTypeChip(selectedFile.name)}
                </Box>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            variant="contained"
            disabled={!selectedFile}
            className="gradient-button"
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BrandingManagement;

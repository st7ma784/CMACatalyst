import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Folder,
  FolderOpen,
  InsertDriveFile,
  Download,
  Delete,
  MoreVert,
  PictureAsPdf,
  Image,
  Description,
  TableChart
} from '@mui/icons-material';
import { formatBytes, formatDate } from '../utils/formatters';

const FileTreeViewer = ({ caseId, onFileSelect, refreshTrigger }) => {
  const [fileTree, setFileTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  useEffect(() => {
    fetchFileTree();
  }, [caseId, refreshTrigger]);

  const fetchFileTree = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/cases/${caseId}/files`);
      if (!response.ok) {
        throw new Error('Failed to fetch file tree');
      }
      
      const tree = await response.json();
      setFileTree(tree);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return <PictureAsPdf color="error" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image color="primary" />;
      case 'doc':
      case 'docx':
        return <Description color="info" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <TableChart color="success" />;
      default:
        return <InsertDriveFile />;
    }
  };

  const getDocumentTypeColor = (folderName) => {
    const typeColors = {
      'debts': 'error',
      'bank-statements': 'success',
      'correspondence': 'info',
      'legal-documents': 'warning',
      'income-documents': 'primary',
      'expense-documents': 'secondary',
      'asset-documents': 'success',
      'internal-documents': 'default',
      'email-attachments': 'info',
      'unclassified': 'default',
      'general': 'default'
    };
    
    return typeColors[folderName] || 'default';
  };

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
    setSelectedFile(file);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setSelectedFile(null);
  };

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`/api/files/${file.key}`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    }
    handleCloseContextMenu();
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/files/${selectedFile.key}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      
      // Refresh file tree
      fetchFileTree();
    } catch (err) {
      console.error('Delete error:', err);
    }
    
    setDeleteDialog(false);
    handleCloseContextMenu();
  };

  const renderFileTreeNode = (node, path = '', level = 0) => {
    if (!node) return null;

    const currentPath = path ? `${path}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(currentPath);

    return (
      <Box key={currentPath}>
        {node.type === 'directory' && (
          <ListItem
            button
            onClick={() => toggleFolder(currentPath)}
            sx={{ 
              pl: level * 2,
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          >
            <ListItemIcon>
              <IconButton size="small">
                {isExpanded ? <ExpandMore /> : <ChevronRight />}
              </IconButton>
              {isExpanded ? <FolderOpen color="primary" /> : <Folder color="primary" />}
            </ListItemIcon>
            <ListItemText 
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" fontWeight="medium">
                    {node.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  <Chip 
                    label={getFileCount(node)}
                    size="small"
                    color={getDocumentTypeColor(node.name)}
                    variant="outlined"
                  />
                </Box>
              }
            />
          </ListItem>
        )}

        <Collapse in={isExpanded || node.type === 'file'} timeout="auto" unmountOnExit>
          {/* Render child directories */}
          {node.children && Object.values(node.children).map(child =>
            renderFileTreeNode(child, currentPath, level + 1)
          )}

          {/* Render files */}
          {node.files && node.files.map(file => (
            <ListItem
              key={file.key}
              button
              onClick={() => onFileSelect && onFileSelect(file)}
              onContextMenu={(e) => handleContextMenu(e, file)}
              sx={{ 
                pl: (level + 1) * 2,
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <ListItemIcon>
                {getFileIcon(file.name)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" noWrap>
                    {file.name}
                  </Typography>
                }
                secondary={
                  <Box display="flex" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(file.size)}
                    </Typography>
                    {file.lastModified && (
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(file.lastModified)}
                      </Typography>
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, file);
                  }}
                >
                  <MoreVert />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </Collapse>
      </Box>
    );
  };

  const getFileCount = (node) => {
    let count = node.files ? node.files.length : 0;
    if (node.children) {
      Object.values(node.children).forEach(child => {
        count += getFileCount(child);
      });
    }
    return count;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading files: {error}
      </Alert>
    );
  }

  if (!fileTree || getFileCount(fileTree) === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body2" color="text.secondary">
          No documents uploaded yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={2} px={2}>
        <Typography variant="h6" gutterBottom>
          Case Documents
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {getFileCount(fileTree)} files organized by category and date
        </Typography>
      </Box>

      <List dense>
        {fileTree.children && Object.values(fileTree.children).map(child =>
          renderFileTreeNode(child, '', 0)
        )}
        {fileTree.files && fileTree.files.map(file =>
          renderFileTreeNode({ ...file, type: 'file' }, '', 0)
        )}
      </List>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleDownload(selectedFile)}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setDeleteDialog(true)}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedFile?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileTreeViewer;

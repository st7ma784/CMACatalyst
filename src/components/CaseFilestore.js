import React, { useState, useEffect, useCallback } from 'react';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction,
    IconButton,
    Breadcrumbs,
    Link,
    Menu,
    MenuItem,
    Divider,
    LinearProgress,
    Tooltip,
    Badge
} from '@mui/material';
import {
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    InsertDriveFile as FileIcon,
    CloudUpload as UploadIcon,
    CreateNewFolder as NewFolderIcon,
    MoreVert as MoreIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    History as HistoryIcon,
    Label as TagIcon,
    GetApp as DownloadIcon,
    Visibility as ViewIcon,
    Delete as DeleteIcon,
    DriveFileMove as MoveIcon,
    AutoFixHigh as AutoOrganizeIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const CaseFilestore = ({ caseId, onFileUploaded }) => {
    const [folders, setFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [files, setFiles] = useState([]);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Dialog states
    const [newFolderDialog, setNewFolderDialog] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [searchDialog, setSearchDialog] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    // Menu states
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    
    // Stats
    const [caseStats, setCaseStats] = useState(null);

    // Load folder structure on mount
    useEffect(() => {
        loadFolderStructure();
        loadCaseStats();
    }, [caseId]);

    const loadFolderStructure = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/case-filestore/${caseId}/folders`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setFolders(response.data.folders);
            
            // If no folders exist, initialize the structure
            if (response.data.folders.length === 0) {
                await initializeFolders();
            }
        } catch (error) {
            console.error('Load folders error:', error);
            setError('Failed to load folder structure');
        } finally {
            setLoading(false);
        }
    };

    const initializeFolders = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/case-filestore/${caseId}/initialize`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Reload folder structure
            await loadFolderStructure();
        } catch (error) {
            console.error('Initialize folders error:', error);
            setError('Failed to initialize folder structure');
        }
    };

    const loadCaseStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/case-filestore/${caseId}/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCaseStats(response.data.stats);
        } catch (error) {
            console.error('Load stats error:', error);
        }
    };

    const loadFolderFiles = async (folderId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/case-filestore/folders/${folderId}/files`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setFiles(response.data.files);
        } catch (error) {
            console.error('Load files error:', error);
            setError('Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const handleFolderClick = (folder) => {
        setCurrentFolder(folder);
        loadFolderFiles(folder.id);
        
        // Update breadcrumbs
        const pathParts = folder.folder_path.split('/').filter(part => part);
        const newBreadcrumbs = pathParts.map((part, index) => ({
            name: part.replace(/_/g, ' ').toUpperCase(),
            path: '/' + pathParts.slice(0, index + 1).join('/')
        }));
        setBreadcrumbs(newBreadcrumbs);
    };

    const handleBreadcrumbClick = (targetPath) => {
        if (targetPath === '/') {
            setCurrentFolder(null);
            setFiles([]);
            setBreadcrumbs([]);
            return;
        }
        
        const targetFolder = findFolderByPath(folders, targetPath);
        if (targetFolder) {
            handleFolderClick(targetFolder);
        }
    };

    const findFolderByPath = (folderList, path) => {
        for (const folder of folderList) {
            if (folder.folder_path === path) {
                return folder;
            }
            if (folder.children) {
                const found = findFolderByPath(folder.children, path);
                if (found) return found;
            }
        }
        return null;
    };

    const onDrop = useCallback(async (acceptedFiles) => {
        if (!currentFolder) {
            setError('Please select a folder first');
            return;
        }

        for (const file of acceptedFiles) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('description', '');
                
                const token = localStorage.getItem('token');
                await axios.post(`/api/case-filestore/${caseId}/folders/${currentFolder.id}/upload`, formData, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } catch (error) {
                console.error('Upload error:', error);
                setError(`Failed to upload ${file.name}`);
            }
        }
        
        // Reload files and stats
        await loadFolderFiles(currentFolder.id);
        await loadCaseStats();
        
        if (onFileUploaded) {
            onFileUploaded();
        }
    }, [caseId, currentFolder, onFileUploaded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.jpeg', '.jpg', '.png', '.tiff'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt']
        },
        maxSize: 50 * 1024 * 1024 // 50MB
    });

    const handleCreateFolder = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/case-filestore/${caseId}/folders`, {
                folderName: newFolderName,
                parentPath: currentFolder?.folder_path || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setNewFolderDialog(false);
            setNewFolderName('');
            await loadFolderStructure();
        } catch (error) {
            console.error('Create folder error:', error);
            setError('Failed to create folder');
        }
    };

    const handleSearch = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/case-filestore/${caseId}/search`, {
                params: { q: searchTerm },
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setSearchResults(response.data.files);
        } catch (error) {
            console.error('Search error:', error);
            setError('Search failed');
        }
    };

    const handleContextMenu = (event, item, type) => {
        event.preventDefault();
        setContextMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
        });
        setSelectedItem({ ...item, type });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
        setSelectedItem(null);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    const renderFolderTree = (folderList, level = 0) => {
        return folderList.map(folder => (
            <Box key={folder.id} sx={{ ml: level * 2 }}>
                <ListItem
                    button
                    onClick={() => handleFolderClick(folder)}
                    onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                    selected={currentFolder?.id === folder.id}
                >
                    <ListItemIcon>
                        <Badge badgeContent={folder.file_count} color="primary">
                            {currentFolder?.id === folder.id ? <FolderOpenIcon /> : <FolderIcon />}
                        </Badge>
                    </ListItemIcon>
                    <ListItemText 
                        primary={folder.folder_name}
                        secondary={`${folder.file_count} files`}
                    />
                </ListItem>
                {folder.children && folder.children.length > 0 && (
                    renderFolderTree(folder.children, level + 1)
                )}
            </Box>
        ));
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Case Document Filestore
            </Typography>

            {/* Case Statistics */}
            {caseStats && (
                <Card sx={{ mb: 2 }}>
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={6} sm={3}>
                                <Typography variant="h6">{caseStats.total_files || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">Total Files</Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Typography variant="h6">{formatFileSize(caseStats.total_size || 0)}</Typography>
                                <Typography variant="body2" color="text.secondary">Storage Used</Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Typography variant="h6">{caseStats.folder_count || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">Folders</Typography>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Typography variant="h6">{caseStats.generated_files || 0}</Typography>
                                <Typography variant="body2" color="text.secondary">Generated</Typography>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Action Bar */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                    startIcon={<NewFolderIcon />}
                    onClick={() => setNewFolderDialog(true)}
                    variant="outlined"
                >
                    New Folder
                </Button>
                <Button
                    startIcon={<SearchIcon />}
                    onClick={() => setSearchDialog(true)}
                    variant="outlined"
                >
                    Search Files
                </Button>
                <Button
                    startIcon={<AutoOrganizeIcon />}
                    variant="outlined"
                    disabled={!currentFolder}
                >
                    Auto Organize
                </Button>
            </Box>

            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
                <Breadcrumbs sx={{ mb: 2 }}>
                    <Link
                        component="button"
                        variant="body2"
                        onClick={() => handleBreadcrumbClick('/')}
                    >
                        Root
                    </Link>
                    {breadcrumbs.map((crumb, index) => (
                        <Link
                            key={index}
                            component="button"
                            variant="body2"
                            onClick={() => handleBreadcrumbClick(crumb.path)}
                        >
                            {crumb.name}
                        </Link>
                    ))}
                </Breadcrumbs>
            )}

            {/* Error Display */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Loading */}
            {loading && <LinearProgress sx={{ mb: 2 }} />}

            <Grid container spacing={2}>
                {/* Folder Tree */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, height: 600, overflow: 'auto' }}>
                        <Typography variant="h6" gutterBottom>
                            Folders
                        </Typography>
                        <List dense>
                            {renderFolderTree(folders)}
                        </List>
                    </Paper>
                </Grid>

                {/* File List / Upload Area */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2, height: 600, overflow: 'auto' }}>
                        {currentFolder ? (
                            <>
                                <Typography variant="h6" gutterBottom>
                                    {currentFolder.folder_name}
                                </Typography>

                                {/* Upload Area */}
                                <Paper
                                    {...getRootProps()}
                                    sx={{
                                        p: 3,
                                        mb: 2,
                                        border: '2px dashed',
                                        borderColor: isDragActive ? 'primary.main' : 'grey.300',
                                        backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                                        cursor: 'pointer',
                                        textAlign: 'center'
                                    }}
                                >
                                    <input {...getInputProps()} />
                                    <UploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
                                    <Typography variant="body1">
                                        {isDragActive ? 'Drop files here' : 'Drag & drop files or click to upload'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        PDF, Images, Word docs, Text files (max 50MB)
                                    </Typography>
                                </Paper>

                                {/* File List */}
                                <List>
                                    {files.map(file => (
                                        <ListItem
                                            key={file.id}
                                            onContextMenu={(e) => handleContextMenu(e, file, 'file')}
                                        >
                                            <ListItemIcon>
                                                <FileIcon />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={file.original_filename}
                                                secondary={
                                                    <Box>
                                                        <Typography variant="caption" display="block">
                                                            {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
                                                        </Typography>
                                                        {file.document_category && (
                                                            <Chip
                                                                label={file.document_category}
                                                                size="small"
                                                                sx={{ mt: 0.5 }}
                                                            />
                                                        )}
                                                        {file.tags && file.tags.length > 0 && (
                                                            <Box sx={{ mt: 0.5 }}>
                                                                {file.tags.map(tag => (
                                                                    <Chip
                                                                        key={tag}
                                                                        label={tag}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ mr: 0.5 }}
                                                                    />
                                                                ))}
                                                            </Box>
                                                        )}
                                                    </Box>
                                                }
                                            />
                                            <ListItemSecondaryAction>
                                                <IconButton
                                                    onClick={(e) => handleContextMenu(e, file, 'file')}
                                                >
                                                    <MoreIcon />
                                                </IconButton>
                                            </ListItemSecondaryAction>
                                        </ListItem>
                                    ))}
                                </List>
                            </>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 8 }}>
                                <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary">
                                    Select a folder to view files
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Choose a folder from the left panel to upload and manage files
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

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
                {selectedItem?.type === 'file' && [
                    <MenuItem key="view" onClick={handleCloseContextMenu}>
                        <ListItemIcon><ViewIcon /></ListItemIcon>
                        <ListItemText>View</ListItemText>
                    </MenuItem>,
                    <MenuItem key="download" onClick={handleCloseContextMenu}>
                        <ListItemIcon><DownloadIcon /></ListItemIcon>
                        <ListItemText>Download</ListItemText>
                    </MenuItem>,
                    <MenuItem key="move" onClick={handleCloseContextMenu}>
                        <ListItemIcon><MoveIcon /></ListItemIcon>
                        <ListItemText>Move</ListItemText>
                    </MenuItem>,
                    <MenuItem key="tag" onClick={handleCloseContextMenu}>
                        <ListItemIcon><TagIcon /></ListItemIcon>
                        <ListItemText>Add Tag</ListItemText>
                    </MenuItem>,
                    <MenuItem key="history" onClick={handleCloseContextMenu}>
                        <ListItemIcon><HistoryIcon /></ListItemIcon>
                        <ListItemText>View History</ListItemText>
                    </MenuItem>,
                    <Divider key="divider" />,
                    <MenuItem key="delete" onClick={handleCloseContextMenu}>
                        <ListItemIcon><DeleteIcon /></ListItemIcon>
                        <ListItemText>Delete</ListItemText>
                    </MenuItem>
                ]}
            </Menu>

            {/* New Folder Dialog */}
            <Dialog open={newFolderDialog} onClose={() => setNewFolderDialog(false)}>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Folder Name"
                        fullWidth
                        variant="outlined"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                    />
                    {currentFolder && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Will be created in: {currentFolder.folder_name}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewFolderDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleCreateFolder}
                        variant="contained"
                        disabled={!newFolderName.trim()}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Search Dialog */}
            <Dialog open={searchDialog} onClose={() => setSearchDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Search Files</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Search Term"
                        fullWidth
                        variant="outlined"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    
                    {searchResults.length > 0 && (
                        <List sx={{ mt: 2 }}>
                            {searchResults.map(file => (
                                <ListItem key={file.id}>
                                    <ListItemIcon>
                                        <FileIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={file.original_filename}
                                        secondary={`${file.folder_path} • ${formatFileSize(file.file_size)}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSearchDialog(false)}>Close</Button>
                    <Button onClick={handleSearch} variant="contained">
                        Search
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CaseFilestore;

import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    IconButton,
    Typography,
    Avatar,
    Fab,
    Collapse,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Chip,
    CircularProgress,
    Alert
} from '@mui/material';
import {
    Chat as ChatIcon,
    Send as SendIcon,
    Close as CloseIcon,
    SmartToy as BotIcon,
    Person as PersonIcon,
    Minimize as MinimizeIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

const ChatbotWidget = ({ caseId = null, isOpen, onToggle }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [socket, setSocket] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [isMinimized, setIsMinimized] = useState(false);
    const messagesEndRef = useRef(null);
    const sessionId = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        if (isOpen && !isMinimized) {
            connectWebSocket();
        } else if (socket) {
            disconnectWebSocket();
        }

        return () => {
            if (socket) {
                disconnectWebSocket();
            }
        };
    }, [isOpen, isMinimized, caseId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const connectWebSocket = () => {
        if (socket?.readyState === WebSocket.OPEN) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/chatbot/ws/chat/${sessionId.current}`;
        
        try {
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                setConnectionStatus('connected');
                setSocket(ws);
                
                // Send initial context message
                if (caseId) {
                    addMessage({
                        type: 'system',
                        content: `Connected to AI assistant for case ${caseId}. I can help you with debt advice, compliance questions, and case management.`,
                        timestamp: new Date()
                    });
                } else {
                    addMessage({
                        type: 'system',
                        content: 'Connected to AI assistant. How can I help you today?',
                        timestamp: new Date()
                    });
                }
            };

            ws.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    addMessage({
                        type: 'bot',
                        content: response.message,
                        timestamp: new Date(response.timestamp)
                    });
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
                setIsLoading(false);
            };

            ws.onclose = () => {
                setConnectionStatus('disconnected');
                setSocket(null);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setConnectionStatus('error');
                setIsLoading(false);
            };

        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            setConnectionStatus('error');
        }
    };

    const disconnectWebSocket = () => {
        if (socket) {
            socket.close();
            setSocket(null);
            setConnectionStatus('disconnected');
        }
    };

    const addMessage = (message) => {
        setMessages(prev => [...prev, {
            id: Date.now() + Math.random(),
            ...message
        }]);
    };

    const sendMessage = () => {
        if (!inputMessage.trim() || !socket || socket.readyState !== WebSocket.OPEN) return;

        const userMessage = {
            type: 'user',
            content: inputMessage.trim(),
            timestamp: new Date()
        };

        addMessage(userMessage);
        setIsLoading(true);

        // Send to WebSocket
        socket.send(JSON.stringify({
            message: inputMessage.trim(),
            case_id: caseId,
            user_id: user?.id,
            timestamp: new Date().toISOString()
        }));

        setInputMessage('');
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getMessageAvatar = (type) => {
        switch (type) {
            case 'bot':
                return <Avatar sx={{ bgcolor: 'primary.main' }}><BotIcon /></Avatar>;
            case 'user':
                return <Avatar sx={{ bgcolor: 'secondary.main' }}><PersonIcon /></Avatar>;
            case 'system':
                return <Avatar sx={{ bgcolor: 'info.main' }}><ChatIcon /></Avatar>;
            default:
                return <Avatar><ChatIcon /></Avatar>;
        }
    };

    const getConnectionStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return 'success';
            case 'error': return 'error';
            default: return 'warning';
        }
    };

    if (!isOpen) {
        return (
            <Fab
                color="primary"
                onClick={onToggle}
                sx={{
                    position: 'fixed',
                    bottom: 16,
                    right: 16,
                    zIndex: 1000
                }}
            >
                <ChatIcon />
            </Fab>
        );
    }

    return (
        <Card
            sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                width: 400,
                height: isMinimized ? 60 : 500,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                transition: 'height 0.3s ease'
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BotIcon />
                    <Typography variant="h6">AI Assistant</Typography>
                    <Chip
                        size="small"
                        label={connectionStatus}
                        color={getConnectionStatusColor()}
                        variant="outlined"
                        sx={{ color: 'inherit', borderColor: 'currentColor' }}
                    />
                </Box>
                <Box>
                    <IconButton
                        size="small"
                        onClick={() => setIsMinimized(!isMinimized)}
                        sx={{ color: 'inherit', mr: 1 }}
                    >
                        <MinimizeIcon />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={onToggle}
                        sx={{ color: 'inherit' }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </Box>

            <Collapse in={!isMinimized}>
                {/* Messages */}
                <Box
                    sx={{
                        flex: 1,
                        overflow: 'auto',
                        maxHeight: 350,
                        p: 1
                    }}
                >
                    {connectionStatus === 'error' && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            Connection failed. Please try refreshing the page.
                        </Alert>
                    )}

                    <List dense>
                        {messages.map((message) => (
                            <ListItem key={message.id} alignItems="flex-start">
                                <ListItemAvatar>
                                    {getMessageAvatar(message.type)}
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100',
                                                    color: message.type === 'user' ? 'primary.contrastText' : 'text.primary',
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    maxWidth: '100%',
                                                    wordWrap: 'break-word'
                                                }}
                                            >
                                                {message.content}
                                            </Typography>
                                        </Box>
                                    }
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            {dayjs(message.timestamp).format('HH:mm')}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))}
                        
                        {isLoading && (
                            <ListItem>
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                                        <CircularProgress size={20} color="inherit" />
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography variant="body2" color="text.secondary">
                                            AI is thinking...
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </List>
                </Box>

                {/* Input */}
                <Box
                    sx={{
                        p: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        gap: 1
                    }}
                >
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Ask me anything about debt advice..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={connectionStatus !== 'connected' || isLoading}
                        multiline
                        maxRows={3}
                    />
                    <IconButton
                        color="primary"
                        onClick={sendMessage}
                        disabled={!inputMessage.trim() || connectionStatus !== 'connected' || isLoading}
                    >
                        <SendIcon />
                    </IconButton>
                </Box>
            </Collapse>
        </Card>
    );
};

export default ChatbotWidget;

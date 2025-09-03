import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Grid,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Alert,
    CircularProgress,
    Paper,
    Divider,
    IconButton,
    Tooltip,
    Switch,
    FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    LinearProgress,
    Badge,
    Fab
} from '@mui/material';
import {
    PlayArrow,
    AutoMode,
    Assessment,
    Description,
    Translate,
    Psychology,
    Timeline,
    Speed,
    Assignment,
    Calculate,
    Email,
    Sms,
    NotificationImportant,
    Help,
    Launch,
    Settings,
    Visibility,
    ExpandMore,
    CheckCircle,
    Warning,
    Error,
    Info,
    Stop,
    Refresh
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const CentreManagerDashboard = () => {
    const { user } = useAuth();
    const [agenticFlows, setAgenticFlows] = useState([]);
    const [centreMetrics, setCentreMetrics] = useState({});
    const [runningFlows, setRunningFlows] = useState(new Set());
    const [completedFlows, setCompletedFlows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [demoDialog, setDemoDialog] = useState(false);
    const [helpDialog, setHelpDialog] = useState(false);
    const [selectedDemo, setSelectedDemo] = useState(null);
    const [demoSteps, setDemoSteps] = useState([]);
    const [currentDemoStep, setCurrentDemoStep] = useState(0);

    // Available Agentic Flows for Centre Managers
    const agenticFlowTemplates = [
        {
            id: 'monthly-centre-report',
            name: 'Monthly Centre Report',
            description: 'Generate comprehensive monthly performance report with AI insights, case summaries, and advisor productivity metrics.',
            icon: <Assessment />,
            category: 'Reporting',
            estimatedTime: '3-5 minutes',
            complexity: 'Simple',
            mcpTools: ['centre_statistics', 'case_analytics', 'staff_performance', 'compliance_check'],
            outputs: ['PDF Report', 'Executive Summary', 'Action Items'],
            benefits: ['Saves 4-6 hours of manual reporting', 'Identifies trends automatically', 'Ensures regulatory compliance'],
            demoAvailable: true
        },
        {
            id: 'staff-workload-optimizer',
            name: 'Staff Workload Optimizer',
            description: 'Analyze current case loads and redistribute work optimally across advisors based on skills, capacity, and case complexity.',
            icon: <Psychology />,
            category: 'Operations',
            estimatedTime: '2-4 minutes',
            complexity: 'Medium',
            mcpTools: ['staff_analysis', 'case_complexity_scoring', 'workload_calculator', 'skill_matching'],
            outputs: ['Workload Report', 'Redistribution Plan', 'Advisor Recommendations'],
            benefits: ['Prevents advisor burnout', 'Optimizes case outcomes', 'Balances workloads automatically'],
            demoAvailable: true
        },
        {
            id: 'priority-case-triage',
            name: 'Priority Case Triage',
            description: 'Automatically identify and flag high-risk cases requiring immediate attention based on vulnerability indicators and debt situations.',
            icon: <Speed />,
            category: 'Risk Management',
            estimatedTime: '1-2 minutes',
            complexity: 'Simple',
            mcpTools: ['vulnerability_scanner', 'debt_risk_analyzer', 'priority_scoring', 'urgent_action_generator'],
            outputs: ['Priority Case List', 'Risk Assessments', 'Immediate Actions'],
            benefits: ['Prevents cases from escalating', 'Ensures vulnerable clients get priority', 'Automates risk assessment'],
            demoAvailable: true
        },
        {
            id: 'batch-letter-generation',
            name: 'Batch Letter Generation',
            description: 'Generate multiple personalized letters (debt plans, confirmations, follow-ups) in bulk using local AI with centre branding.',
            icon: <Description />,
            category: 'Documentation',
            estimatedTime: '5-10 minutes',
            complexity: 'Medium',
            mcpTools: ['bulk_coa_generator', 'letter_templating', 'brand_application', 'quality_checker'],
            outputs: ['PDF Letters', 'Quality Report', 'Approval Queue'],
            benefits: ['Saves 2-3 hours per batch', 'Ensures consistency', 'Maintains professional standards'],
            demoAvailable: true
        },
        {
            id: 'compliance-audit-runner',
            name: 'Compliance Audit Runner',
            description: 'Perform comprehensive FCA compliance checks across all cases, identifying gaps and generating remediation plans.',
            icon: <Assignment />,
            category: 'Compliance',
            estimatedTime: '10-15 minutes',
            complexity: 'Complex',
            mcpTools: ['fca_compliance_checker', 'data_completeness_validator', 'audit_trail_analyzer', 'remediation_planner'],
            outputs: ['Compliance Report', 'Gap Analysis', 'Remediation Plan'],
            benefits: ['Ensures FCA compliance', 'Prevents regulatory issues', 'Automates audit preparation'],
            demoAvailable: false
        },
        {
            id: 'multilingual-client-outreach',
            name: 'Multilingual Client Outreach',
            description: 'Generate personalized client communications in multiple languages using local translation models.',
            icon: <Translate />,
            category: 'Communication',
            estimatedTime: '5-8 minutes',
            complexity: 'Medium',
            mcpTools: ['client_segmentation', 'message_templating', 'local_translator', 'delivery_scheduler'],
            outputs: ['Translated Messages', 'Delivery Schedule', 'Response Tracking'],
            benefits: ['Reaches diverse communities', 'Maintains data privacy', 'Scales communication efforts'],
            demoAvailable: true
        }
    ];

    useEffect(() => {
        initializeDashboard();
    }, []);

    const initializeDashboard = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadAgenticFlows(),
                loadCentreMetrics(),
                loadRecentExecutions()
            ]);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAgenticFlows = async () => {
        setAgenticFlows(agenticFlowTemplates);
    };

    const loadCentreMetrics = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/centres/current/metrics', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCentreMetrics(response.data);
        } catch (error) {
            console.error('Error loading centre metrics:', error);
        }
    };

    const loadRecentExecutions = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/agentic-flows/recent', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompletedFlows(response.data.executions || []);
        } catch (error) {
            console.error('Error loading recent executions:', error);
        }
    };

    const executeAgenticFlow = async (flowId, parameters = {}) => {
        setRunningFlows(prev => new Set([...prev, flowId]));
        
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/agentic-flows/execute', {
                flowId,
                centreId: user.centre_id,
                parameters
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                loadRecentExecutions();
                loadCentreMetrics();
            }
        } catch (error) {
            console.error(`Error executing flow ${flowId}:`, error);
        } finally {
            setRunningFlows(prev => {
                const newSet = new Set(prev);
                newSet.delete(flowId);
                return newSet;
            });
        }
    };

    const runDemo = (flowId) => {
        const flow = agenticFlows.find(f => f.id === flowId);
        setSelectedDemo(flow);
        
        // Create demo steps based on flow type
        const demoStepsMap = {
            'monthly-centre-report': [
                { label: 'Gathering case statistics', description: 'Analyzing 47 active cases and 12 closed cases this month...' },
                { label: 'Calculating advisor metrics', description: 'Reviewing performance data for 8 staff members...' },
                { label: 'Running compliance checks', description: 'Validating FCA requirements across all cases...' },
                { label: 'Generating AI insights', description: 'Identifying trends and recommendations...' },
                { label: 'Creating PDF report', description: 'Formatting report with centre branding...' }
            ],
            'staff-workload-optimizer': [
                { label: 'Analyzing current workloads', description: 'Reviewing case assignments for all advisors...' },
                { label: 'Scoring case complexity', description: 'AI assessment of case difficulty and time requirements...' },
                { label: 'Optimizing distribution', description: 'Calculating optimal case assignments...' },
                { label: 'Generating recommendations', description: 'Creating workload rebalancing plan...' }
            ],
            'priority-case-triage': [
                { label: 'Scanning all cases', description: 'Reviewing 47 active cases for risk indicators...' },
                { label: 'AI risk assessment', description: 'Analyzing vulnerability factors and debt situations...' },
                { label: 'Priority scoring', description: 'Calculating urgency scores for each case...' },
                { label: 'Creating action plan', description: 'Generating immediate action recommendations...' }
            ]
        };

        setDemoSteps(demoStepsMap[flowId] || []);
        setCurrentDemoStep(0);
        setDemoDialog(true);
        
        // Simulate step progression
        const stepInterval = setInterval(() => {
            setCurrentDemoStep(prev => {
                if (prev >= (demoStepsMap[flowId]?.length || 0) - 1) {
                    clearInterval(stepInterval);
                    return prev;
                }
                return prev + 1;
            });
        }, 2000);
    };

    const FlowCard = ({ flow, isRunning }) => (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {isRunning && (
                <LinearProgress 
                    sx={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        zIndex: 1 
                    }} 
                />
            )}
            <CardContent sx={{ flexGrow: 1, pt: isRunning ? 2 : undefined }}>
                <Box display="flex" alignItems="center" mb={2}>
                    {flow.icon}
                    <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                        {flow.name}
                    </Typography>
                    <Tooltip title="Help">
                        <IconButton 
                            size="small" 
                            onClick={() => {
                                setSelectedDemo(flow);
                                setHelpDialog(true);
                            }}
                        >
                            <Help />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Typography variant="body2" color="text.secondary" mb={2}>
                    {flow.description}
                </Typography>

                <Box mb={2}>
                    <Chip label={flow.category} size="small" color="primary" sx={{ mr: 1 }} />
                    <Chip label={flow.complexity} size="small" variant="outlined" sx={{ mr: 1 }} />
                    <Chip label={flow.estimatedTime} size="small" variant="outlined" />
                </Box>

                <Typography variant="caption" color="text.secondary" paragraph>
                    <strong>Benefits:</strong> {flow.benefits[0]}
                </Typography>
            </CardContent>
            
            <Box p={2} pt={0}>
                <Grid container spacing={1}>
                    <Grid item xs={flow.demoAvailable ? 8 : 12}>
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={() => executeAgenticFlow(flow.id)}
                            disabled={isRunning || loading}
                            startIcon={isRunning ? <CircularProgress size={20} /> : <PlayArrow />}
                            sx={{ textTransform: 'none' }}
                        >
                            {isRunning ? 'Running...' : 'Execute'}
                        </Button>
                    </Grid>
                    {flow.demoAvailable && (
                        <Grid item xs={4}>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={() => runDemo(flow.id)}
                                disabled={isRunning}
                                startIcon={<Visibility />}
                                sx={{ textTransform: 'none' }}
                            >
                                Demo
                            </Button>
                        </Grid>
                    )}
                </Grid>
            </Box>
        </Card>
    );

    const MetricCard = ({ title, value, icon, color = "primary", subtitle }) => (
        <Card>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                        <Typography variant="h4" color={color + '.main'} fontWeight="bold">
                            {value || '...'}
                        </Typography>
                        <Typography variant="h6" color="text.primary">
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography variant="body2" color="text.secondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ color: color + '.main', fontSize: 40 }}>
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box className="fade-in" sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                        Centre Manager Dashboard
                    </Typography>
                    <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        AI-powered centre management and workflow automation
                    </Typography>
                </Box>
                <Badge badgeContent={runningFlows.size} color="primary">
                    <Fab 
                        color="secondary" 
                        onClick={() => setHelpDialog(true)}
                        sx={{ mr: 2 }}
                    >
                        <Help />
                    </Fab>
                </Badge>
            </Box>

            {/* Centre Metrics Overview */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Active Cases"
                        value={centreMetrics.activeCases || 0}
                        icon={<Assignment />}
                        color="primary"
                        subtitle="Cases requiring attention"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Staff Members"
                        value={centreMetrics.activeStaff || 0}
                        icon={<Psychology />}
                        color="success"
                        subtitle="Active advisors and managers"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="AI Tasks Today"
                        value={centreMetrics.aiTasksToday || 0}
                        icon={<AutoMode />}
                        color="secondary"
                        subtitle="Automated tasks completed"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Efficiency Gain"
                        value={`${centreMetrics.efficiencyGain || 0}%`}
                        icon={<Speed />}
                        color="warning"
                        subtitle="Time saved vs manual processes"
                    />
                </Grid>
            </Grid>

            {/* Quick Actions */}
            <Card className="modern-card" sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Quick Actions
                        <Tooltip title="These actions use local AI models - no data leaves your centre">
                            <IconButton size="small" sx={{ ml: 1 }}>
                                <Info />
                            </IconButton>
                        </Tooltip>
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item>
                            <Button
                                variant="contained"
                                startIcon={<Assessment />}
                                onClick={() => executeAgenticFlow('monthly-centre-report')}
                                disabled={runningFlows.has('monthly-centre-report')}
                                sx={{ textTransform: 'none' }}
                            >
                                Generate Monthly Report
                            </Button>
                        </Grid>
                        <Grid item>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<Psychology />}
                                onClick={() => executeAgenticFlow('staff-workload-optimizer')}
                                disabled={runningFlows.has('staff-workload-optimizer')}
                                sx={{ textTransform: 'none' }}
                            >
                                Optimize Workloads
                            </Button>
                        </Grid>
                        <Grid item>
                            <Button
                                variant="outlined"
                                startIcon={<Speed />}
                                onClick={() => executeAgenticFlow('priority-case-triage')}
                                disabled={runningFlows.has('priority-case-triage')}
                                sx={{ textTransform: 'none' }}
                            >
                                Triage Priority Cases
                            </Button>
                        </Grid>
                        <Grid item>
                            <Button
                                variant="outlined"
                                startIcon={<Description />}
                                onClick={() => executeAgenticFlow('batch-letter-generation')}
                                disabled={runningFlows.has('batch-letter-generation')}
                                sx={{ textTransform: 'none' }}
                            >
                                Generate Letters
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Available Agentic Flows */}
            <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
                Available Agentic Flows
                <Tooltip title="All flows use locally hosted AI models for complete data privacy">
                    <IconButton size="small" sx={{ ml: 1, color: 'rgba(255,255,255,0.8)' }}>
                        <Info />
                    </IconButton>
                </Tooltip>
            </Typography>

            <Grid container spacing={3} mb={4}>
                {agenticFlows.map((flow) => (
                    <Grid item xs={12} md={6} lg={4} key={flow.id}>
                        <FlowCard 
                            flow={flow} 
                            isRunning={runningFlows.has(flow.id)}
                        />
                    </Grid>
                ))}
            </Grid>

            {/* Recent Executions */}
            {completedFlows.length > 0 && (
                <Card className="modern-card">
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Recent Workflow Executions
                        </Typography>
                        <List>
                            {completedFlows.slice(0, 5).map((execution, index) => (
                                <ListItem key={index} divider>
                                    <ListItemIcon>
                                        <CheckCircle color="success" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={execution.flowName}
                                        secondary={`Completed: ${new Date(execution.completedAt).toLocaleString()} | Duration: ${execution.duration}s`}
                                    />
                                    <Chip 
                                        label={`${execution.tasksCompleted} tasks`}
                                        size="small"
                                        color="success"
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            )}

            {/* Demo Dialog */}
            <Dialog 
                open={demoDialog} 
                onClose={() => setDemoDialog(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center">
                        {selectedDemo?.icon}
                        <Typography variant="h6" sx={{ ml: 1 }}>
                            Demo: {selectedDemo?.name}
                        </Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 3 }}>
                        This is a demonstration of how the agentic flow would execute. 
                        No real data is being processed.
                    </Alert>
                    
                    <Stepper activeStep={currentDemoStep} orientation="vertical">
                        {demoSteps.map((step, index) => (
                            <Step key={index}>
                                <StepLabel>
                                    {step.label}
                                </StepLabel>
                                <StepContent>
                                    <Typography variant="body2" color="text.secondary">
                                        {step.description}
                                    </Typography>
                                    {index === currentDemoStep && index < demoSteps.length - 1 && (
                                        <Box sx={{ mt: 1 }}>
                                            <CircularProgress size={20} />
                                            <Typography variant="caption" sx={{ ml: 1 }}>
                                                Processing...
                                            </Typography>
                                        </Box>
                                    )}
                                    {index === demoSteps.length - 1 && currentDemoStep >= index && (
                                        <Alert severity="success" sx={{ mt: 2 }}>
                                            Demo workflow completed! In a real execution, results would be saved to your case management system.
                                        </Alert>
                                    )}
                                </StepContent>
                            </Step>
                        ))}
                    </Stepper>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDemoDialog(false)}>
                        Close Demo
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={() => {
                            setDemoDialog(false);
                            executeAgenticFlow(selectedDemo.id);
                        }}
                        startIcon={<PlayArrow />}
                    >
                        Run Real Workflow
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Help Dialog */}
            <Dialog 
                open={helpDialog} 
                onClose={() => setHelpDialog(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle>
                    <Typography variant="h5">
                        Agentic Workflows - Centre Manager Guide
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3, height: '100%' }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    What are Agentic Flows?
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    Agentic flows are AI-powered workflows that automate complex, multi-step centre management tasks. 
                                    They use local AI models to analyze data, generate insights, and create documents without sending 
                                    any data outside your centre.
                                </Typography>
                                
                                <Divider sx={{ my: 2 }} />
                                
                                <Typography variant="subtitle1" gutterBottom>
                                    Key Benefits:
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                                        <ListItemText primary="Complete data privacy - all AI processing happens locally" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                                        <ListItemText primary="Saves 60-80% of time on routine management tasks" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                                        <ListItemText primary="Consistent, professional outputs every time" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                                        <ListItemText primary="Identifies patterns and insights humans might miss" />
                                    </ListItem>
                                </List>
                            </Paper>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3, height: '100%' }}>
                                <Typography variant="h6" gutterBottom color="secondary">
                                    How to Get Started
                                </Typography>
                                
                                <Box mb={2}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        1. Try a Demo First
                                    </Typography>
                                    <Typography variant="body2" paragraph>
                                        Click the "Demo" button on any workflow to see exactly what it does 
                                        without affecting real data.
                                    </Typography>
                                </Box>
                                
                                <Box mb={2}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        2. Start with Simple Flows
                                    </Typography>
                                    <Typography variant="body2" paragraph>
                                        Begin with "Simple" complexity flows like Priority Case Triage 
                                        to get familiar with the process.
                                    </Typography>
                                </Box>
                                
                                <Box mb={2}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        3. Review Results Carefully
                                    </Typography>
                                    <Typography variant="body2" paragraph>
                                        Always review AI-generated outputs before using them. The AI provides 
                                        excellent drafts, but human oversight ensures quality.
                                    </Typography>
                                </Box>
                                
                                <Box mb={2}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        4. Monitor Performance
                                    </Typography>
                                    <Typography variant="body2">
                                        Track which workflows save you the most time and adjust your 
                                        centre's processes accordingly.
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>
                        
                        <Grid item xs={12}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom color="error">
                                    Important Data Privacy Information
                                </Typography>
                                <Alert severity="success" sx={{ mb: 2 }}>
                                    <Typography variant="body2">
                                        <strong>Your Data Stays Local:</strong> All AI processing happens on your servers using 
                                        locally hosted models. Client data never leaves your infrastructure.
                                    </Typography>
                                </Alert>
                                <Alert severity="info">
                                    <Typography variant="body2">
                                        <strong>Optional External Services:</strong> Some features like web search for council 
                                        information use external APIs, but no client data is included in these requests.
                                    </Typography>
                                </Alert>
                            </Paper>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setHelpDialog(false)}>
                        Close Guide
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={() => window.open('/docs/agentic-workflows-guide.pdf', '_blank')}
                        startIcon={<Launch />}
                    >
                        View Full Documentation
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Flow Details Dialog */}
            {selectedDemo && (
                <Dialog 
                    open={helpDialog} 
                    onClose={() => setHelpDialog(false)}
                    maxWidth="md"
                    fullWidth
                    PaperProps={{ sx: { borderRadius: 3 } }}
                >
                    <DialogTitle>
                        <Box display="flex" alignItems="center">
                            {selectedDemo.icon}
                            <Typography variant="h6" sx={{ ml: 1 }}>
                                {selectedDemo.name}
                            </Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" paragraph>
                            {selectedDemo.description}
                        </Typography>
                        
                        <Box mb={3}>
                            <Typography variant="subtitle1" gutterBottom>
                                Workflow Details:
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        <strong>Estimated Time:</strong> {selectedDemo.estimatedTime}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">
                                        <strong>Complexity:</strong> {selectedDemo.complexity}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>

                        <Box mb={3}>
                            <Typography variant="subtitle1" gutterBottom>
                                MCP Tools Used:
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                                {selectedDemo.mcpTools.map((tool, index) => (
                                    <Chip 
                                        key={index} 
                                        label={tool.replace(/_/g, ' ')} 
                                        size="small" 
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        </Box>

                        <Box mb={3}>
                            <Typography variant="subtitle1" gutterBottom>
                                Expected Outputs:
                            </Typography>
                            <List dense>
                                {selectedDemo.outputs.map((output, index) => (
                                    <ListItem key={index}>
                                        <ListItemIcon>
                                            <Description color="primary" />
                                        </ListItemIcon>
                                        <ListItemText primary={output} />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" gutterBottom>
                                Benefits:
                            </Typography>
                            <List dense>
                                {selectedDemo.benefits.map((benefit, index) => (
                                    <ListItem key={index}>
                                        <ListItemIcon>
                                            <CheckCircle color="success" />
                                        </ListItemIcon>
                                        <ListItemText primary={benefit} />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setHelpDialog(false)}>
                            Close
                        </Button>
                        {selectedDemo.demoAvailable && (
                            <Button 
                                variant="outlined"
                                onClick={() => {
                                    setHelpDialog(false);
                                    runDemo(selectedDemo.id);
                                }}
                                startIcon={<Visibility />}
                            >
                                Run Demo
                            </Button>
                        )}
                        <Button 
                            variant="contained"
                            onClick={() => {
                                setHelpDialog(false);
                                executeAgenticFlow(selectedDemo.id);
                            }}
                            startIcon={<PlayArrow />}
                        >
                            Execute Workflow
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
};

export default CentreManagerDashboard;
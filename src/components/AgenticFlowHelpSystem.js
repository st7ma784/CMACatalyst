import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Button,
    Box,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Paper,
    Alert,
    Chip,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Card,
    CardContent,
    Grid,
    Tooltip,
    IconButton,
    LinearProgress
} from '@mui/material';
import {
    Help,
    PlayArrow,
    CheckCircle,
    Warning,
    Info,
    Security,
    Speed,
    ExpandMore,
    Launch,
    Visibility,
    Psychology,
    Assignment,
    Calculate,
    Description,
    Translate,
    Assessment,
    Close
} from '@mui/icons-material';

const AgenticFlowHelpSystem = ({ 
    open, 
    onClose, 
    selectedFlow,
    onRunDemo,
    onExecuteFlow 
}) => {
    const [activeStep, setActiveStep] = useState(0);
    const [showQuickStart, setShowQuickStart] = useState(false);

    const getFlowSteps = (flowId) => {
        const stepMaps = {
            'monthly-centre-report': [
                {
                    label: 'Data Collection',
                    description: 'AI gathers case statistics, staff metrics, and compliance data from your local database',
                    duration: '30 seconds',
                    aiTool: 'centre_statistics'
                },
                {
                    label: 'Performance Analysis', 
                    description: 'Local AI analyzes trends, identifies patterns, and calculates key performance indicators',
                    duration: '1-2 minutes',
                    aiTool: 'case_analytics'
                },
                {
                    label: 'Report Generation',
                    description: 'AI creates professional report with insights, recommendations, and centre branding',
                    duration: '1-2 minutes', 
                    aiTool: 'document_generator'
                },
                {
                    label: 'Quality Review',
                    description: 'System validates report completeness and flags any areas needing attention',
                    duration: '30 seconds',
                    aiTool: 'quality_checker'
                }
            ],
            'staff-workload-optimizer': [
                {
                    label: 'Workload Assessment',
                    description: 'AI analyzes current case assignments and advisor capacity across your centre',
                    duration: '45 seconds',
                    aiTool: 'staff_analysis'
                },
                {
                    label: 'Complexity Scoring',
                    description: 'Each case is scored for complexity using AI assessment of debt situation and client needs',
                    duration: '1-2 minutes',
                    aiTool: 'case_complexity_scoring'
                },
                {
                    label: 'Optimization',
                    description: 'AI calculates optimal case distribution considering skills, experience, and current workload',
                    duration: '1 minute',
                    aiTool: 'workload_calculator'
                },
                {
                    label: 'Recommendations',
                    description: 'System generates specific recommendations for case reassignments and workload balancing',
                    duration: '30 seconds',
                    aiTool: 'recommendation_engine'
                }
            ],
            'priority-case-triage': [
                {
                    label: 'Case Scanning',
                    description: 'AI reviews all active cases for vulnerability indicators and risk factors',
                    duration: '30 seconds',
                    aiTool: 'vulnerability_scanner'
                },
                {
                    label: 'Risk Assessment',
                    description: 'Each case receives AI-calculated priority score based on debt situation and client needs',
                    duration: '1 minute',
                    aiTool: 'debt_risk_analyzer'
                },
                {
                    label: 'Priority Ranking',
                    description: 'Cases are ranked by urgency with specific action recommendations',
                    duration: '30 seconds',
                    aiTool: 'priority_scoring'
                }
            ]
        };
        
        return stepMaps[flowId] || [];
    };

    const getFlowBenefits = (flowId) => {
        const benefitMaps = {
            'monthly-centre-report': [
                'Saves 4-6 hours of manual data gathering and analysis',
                'Identifies trends and patterns you might miss',
                'Ensures consistent report format and compliance',
                'Provides AI-generated insights and recommendations',
                'Automatically includes all required regulatory information'
            ],
            'staff-workload-optimizer': [
                'Prevents advisor burnout through balanced case distribution',
                'Improves case outcomes by matching advisor skills to case needs',
                'Identifies training opportunities for staff development',
                'Reduces case completion times through optimal assignments',
                'Provides objective, data-driven workload recommendations'
            ],
            'priority-case-triage': [
                'Prevents cases from escalating by catching issues early',
                'Ensures vulnerable clients receive priority attention',
                'Reduces regulatory compliance risks',
                'Automates time-consuming manual case reviews',
                'Provides consistent, objective priority assessment'
            ]
        };
        
        return benefitMaps[flowId] || [];
    };

    const getDataPrivacyInfo = () => (
        <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
                <strong>Complete Data Privacy:</strong> All AI processing happens on your local servers. 
                No client data is sent to external services. Your information stays within your centre.
            </Typography>
        </Alert>
    );

    const QuickStartGuide = () => (
        <Box>
            <Typography variant="h6" gutterBottom>
                Quick Start Guide for {selectedFlow?.name}
            </Typography>
            
            {getDataPrivacyInfo()}
            
            <Grid container spacing={2} mb={3}>
                <Grid item xs={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="subtitle1" gutterBottom color="primary">
                                <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Estimated Time
                            </Typography>
                            <Typography variant="h6">
                                {selectedFlow?.estimatedTime}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="subtitle1" gutterBottom color="secondary">
                                <Psychology sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Complexity
                            </Typography>
                            <Typography variant="h6">
                                {selectedFlow?.complexity}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom>
                What This Workflow Does:
            </Typography>
            <Stepper activeStep={-1} orientation="vertical" sx={{ mb: 3 }}>
                {getFlowSteps(selectedFlow?.id).map((step, index) => (
                    <Step key={index} completed={false}>
                        <StepLabel>
                            <Box>
                                <Typography variant="body1">{step.label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {step.duration} | AI Tool: {step.aiTool}
                                </Typography>
                            </Box>
                        </StepLabel>
                        <StepContent>
                            <Typography variant="body2" color="text.secondary">
                                {step.description}
                            </Typography>
                        </StepContent>
                    </Step>
                ))}
            </Stepper>

            <Typography variant="subtitle1" gutterBottom>
                Benefits You'll See:
            </Typography>
            <List dense>
                {getFlowBenefits(selectedFlow?.id).map((benefit, index) => (
                    <ListItem key={index}>
                        <ListItemIcon>
                            <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText primary={benefit} />
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    const TechnicalDetails = () => (
        <Box>
            <Typography variant="h6" gutterBottom>
                Technical Details
            </Typography>
            
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">
                        AI Models and Tools Used
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" gutterBottom>
                                Local AI Models:
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText 
                                        primary="Hugging Face DialoGPT"
                                        secondary="Text generation and analysis"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText 
                                        primary="Helsinki-NLP Translator"
                                        secondary="Multi-language translation"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText 
                                        primary="PostgreSQL Analytics"
                                        secondary="Data analysis and aggregation"
                                    />
                                </ListItem>
                            </List>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" gutterBottom>
                                MCP Tools:
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                                {selectedFlow?.mcpTools?.map((tool, index) => (
                                    <Chip 
                                        key={index}
                                        label={tool.replace(/_/g, ' ')}
                                        size="small"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>
            
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">
                        Data Access and Security
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            This workflow only accesses data within your centre. No information is shared 
                            with external services or other centres.
                        </Typography>
                    </Alert>
                    <Typography variant="body2">
                        <strong>Data Accessed:</strong> Case records, client information (anonymized for AI processing), 
                        staff performance metrics, appointment schedules, and compliance records - all within your centre only.
                    </Typography>
                </AccordionDetails>
            </Accordion>

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">
                        Expected Outputs
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <List dense>
                        {selectedFlow?.outputs?.map((output, index) => (
                            <ListItem key={index}>
                                <ListItemIcon>
                                    <Description color="primary" />
                                </ListItemIcon>
                                <ListItemText 
                                    primary={output}
                                    secondary="Generated locally using your centre's AI models"
                                />
                            </ListItem>
                        ))}
                    </List>
                </AccordionDetails>
            </Accordion>
        </Box>
    );

    const SafetyChecklist = () => (
        <Box>
            <Typography variant="h6" gutterBottom color="warning.main">
                Pre-Execution Safety Checklist
            </Typography>
            
            <List>
                <ListItem>
                    <ListItemIcon>
                        <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText 
                        primary="Data Privacy Verified"
                        secondary="All processing happens on your local AI models"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <Security color="success" />
                    </ListItemIcon>
                    <ListItemText 
                        primary="Compliance Maintained"
                        secondary="Workflow follows FCA guidelines for debt advice centres"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <Psychology color="info" />
                    </ListItemIcon>
                    <ListItemText 
                        primary="Human Oversight Required"
                        secondary="Always review AI-generated outputs before use"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <Assignment color="info" />
                    </ListItemIcon>
                    <ListItemText 
                        primary="Audit Trail Created"
                        secondary="All workflow executions are logged for compliance"
                    />
                </ListItem>
            </List>
            
            <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                    <strong>Important:</strong> While AI workflows save significant time and reduce errors, 
                    final decisions about client advice should always involve qualified advisors.
                </Typography>
            </Alert>
        </Box>
    );

    if (!selectedFlow) return null;

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
        >
            <DialogTitle>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center">
                        {selectedFlow.icon}
                        <Box ml={1}>
                            <Typography variant="h6">
                                {selectedFlow.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {selectedFlow.category} • {selectedFlow.complexity} Complexity
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={onClose}>
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>
            
            <DialogContent dividers>
                {!showQuickStart ? (
                    <Box>
                        <Typography variant="body1" paragraph>
                            {selectedFlow.description}
                        </Typography>
                        
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <QuickStartGuide />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <SafetyChecklist />
                            </Grid>
                            <Grid item xs={12}>
                                <TechnicalDetails />
                            </Grid>
                        </Grid>
                    </Box>
                ) : (
                    <Box>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                <strong>Quick Start Mode:</strong> Follow these steps to run your first agentic workflow safely.
                            </Typography>
                        </Alert>
                        
                        <Stepper activeStep={activeStep} orientation="vertical">
                            <Step>
                                <StepLabel>
                                    <Typography variant="subtitle1">
                                        Understand What the Workflow Does
                                    </Typography>
                                </StepLabel>
                                <StepContent>
                                    <Typography variant="body2" paragraph>
                                        Read the workflow description and review the steps it will take. 
                                        Make sure you understand what data it will access and what outputs it will create.
                                    </Typography>
                                    <Button 
                                        variant="outlined" 
                                        onClick={() => setActiveStep(1)}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        I understand the workflow
                                    </Button>
                                </StepContent>
                            </Step>
                            
                            <Step>
                                <StepLabel>
                                    <Typography variant="subtitle1">
                                        Try the Demo First (Recommended)
                                    </Typography>
                                </StepLabel>
                                <StepContent>
                                    <Typography variant="body2" paragraph>
                                        Run a demo to see exactly how the workflow operates without affecting real data. 
                                        This helps you understand the process and outputs.
                                    </Typography>
                                    <Box>
                                        <Button 
                                            variant="contained"
                                            startIcon={<Visibility />}
                                            onClick={() => {
                                                onRunDemo(selectedFlow.id);
                                                setActiveStep(2);
                                            }}
                                            sx={{ textTransform: 'none', mr: 2 }}
                                            disabled={!selectedFlow.demoAvailable}
                                        >
                                            {selectedFlow.demoAvailable ? 'Run Demo' : 'Demo Not Available'}
                                        </Button>
                                        <Button 
                                            variant="outlined"
                                            onClick={() => setActiveStep(2)}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Skip Demo
                                        </Button>
                                    </Box>
                                </StepContent>
                            </Step>
                            
                            <Step>
                                <StepLabel>
                                    <Typography variant="subtitle1">
                                        Execute the Real Workflow
                                    </Typography>
                                </StepLabel>
                                <StepContent>
                                    <Typography variant="body2" paragraph>
                                        Ready to run the workflow with your real centre data. The AI will process 
                                        your information locally and generate outputs for your review.
                                    </Typography>
                                    <Alert severity="warning" sx={{ mb: 2 }}>
                                        <Typography variant="body2">
                                            <strong>Remember:</strong> Always review AI-generated outputs before using them 
                                            in your centre operations or client communications.
                                        </Typography>
                                    </Alert>
                                    <Button 
                                        variant="contained"
                                        color="primary"
                                        startIcon={<PlayArrow />}
                                        onClick={() => {
                                            onExecuteFlow(selectedFlow.id);
                                            onClose();
                                        }}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Execute Workflow
                                    </Button>
                                </StepContent>
                            </Step>
                        </Stepper>
                    </Box>
                )}
            </DialogContent>
            
            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform: 'none' }}>
                    Close Help
                </Button>
                
                {!showQuickStart ? (
                    <>
                        <Button 
                            variant="outlined"
                            onClick={() => setShowQuickStart(true)}
                            startIcon={<Help />}
                            sx={{ textTransform: 'none' }}
                        >
                            Quick Start Guide
                        </Button>
                        
                        {selectedFlow.demoAvailable && (
                            <Button 
                                variant="outlined"
                                onClick={() => onRunDemo(selectedFlow.id)}
                                startIcon={<Visibility />}
                                sx={{ textTransform: 'none' }}
                            >
                                Run Demo
                            </Button>
                        )}
                        
                        <Button 
                            variant="contained"
                            onClick={() => onExecuteFlow(selectedFlow.id)}
                            startIcon={<PlayArrow />}
                            sx={{ textTransform: 'none' }}
                        >
                            Execute Workflow
                        </Button>
                    </>
                ) : (
                    <Button 
                        variant="outlined"
                        onClick={() => setShowQuickStart(false)}
                        sx={{ textTransform: 'none' }}
                    >
                        Back to Details
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

// Tooltip Help Component for workflow buttons
export const WorkflowHelpTooltip = ({ workflow, children }) => {
    return (
        <Tooltip
            title={
                <Box sx={{ p: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                        {workflow.name}
                    </Typography>
                    <Typography variant="caption" display="block">
                        {workflow.description}
                    </Typography>
                    <Box mt={1}>
                        <Chip label={workflow.estimatedTime} size="small" sx={{ mr: 0.5 }} />
                        <Chip label={workflow.complexity} size="small" />
                    </Box>
                </Box>
            }
            placement="top"
            arrow
        >
            {children}
        </Tooltip>
    );
};

// Quick action button with help
export const AgenticFlowButton = ({ 
    workflow, 
    isRunning, 
    onExecute, 
    onShowHelp,
    variant = "contained",
    size = "medium",
    fullWidth = false
}) => {
    return (
        <Box position="relative">
            <Button
                variant={variant}
                size={size}
                fullWidth={fullWidth}
                onClick={() => onExecute(workflow.id)}
                disabled={isRunning}
                startIcon={isRunning ? <LinearProgress /> : workflow.icon}
                sx={{ textTransform: 'none' }}
            >
                {isRunning ? 'Running...' : workflow.name}
            </Button>
            
            <Tooltip title="Get help with this workflow">
                <IconButton
                    size="small"
                    onClick={() => onShowHelp(workflow)}
                    sx={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        bgcolor: 'background.paper',
                        boxShadow: 1,
                        width: 24,
                        height: 24,
                        '&:hover': {
                            bgcolor: 'primary.light',
                            color: 'white'
                        }
                    }}
                >
                    <Help fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export default AgenticFlowHelpSystem;
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
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Alert,
    CircularProgress,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Paper,
    Divider,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    PlayArrow,
    Stop,
    Refresh,
    ExpandMore,
    CheckCircle,
    Warning,
    Error,
    Info,
    Assignment,
    Calculate,
    QuestionAnswer,
    Description,
    Timeline,
    Speed
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const AgenticWorkflow = ({ caseId, onWorkflowComplete }) => {
    const { user } = useAuth();
    const [workflows, setWorkflows] = useState([]);
    const [executions, setExecutions] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [executionResults, setExecutionResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [executionDialog, setExecutionDialog] = useState(false);
    const [resultsDialog, setResultsDialog] = useState(false);

    useEffect(() => {
        loadWorkflowTemplates();
        if (caseId) {
            loadCaseExecutions();
        }
    }, [caseId]);

    const loadWorkflowTemplates = async () => {
        try {
            const response = await fetch('/api/agentic-workflow/templates', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setWorkflows(data.templates);
        } catch (error) {
            console.error('Error loading workflow templates:', error);
        }
    };

    const loadCaseExecutions = async () => {
        try {
            const response = await fetch(`/api/agentic-workflow/case/${caseId}/executions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setExecutions(data.executions);
        } catch (error) {
            console.error('Error loading case executions:', error);
        }
    };

    const executeWorkflow = async (workflowName, additionalData = {}) => {
        setLoading(true);
        try {
            const response = await fetch('/api/agentic-workflow/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    workflowName,
                    caseId,
                    initialData: additionalData
                })
            });

            const result = await response.json();
            
            if (result.success) {
                setExecutionResults(result);
                setResultsDialog(true);
                loadCaseExecutions(); // Refresh executions
                if (onWorkflowComplete) {
                    onWorkflowComplete(result);
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error executing workflow:', error);
            alert(`Workflow execution failed: ${error.message}`);
        } finally {
            setLoading(false);
            setExecutionDialog(false);
        }
    };

    const runComprehensiveReview = () => {
        executeWorkflow('COMPREHENSIVE_CASE_REVIEW', { includeLetterGeneration: true });
    };

    const runDebtComparison = () => {
        executeWorkflow('DEBT_SOLUTION_COMPARISON');
    };

    const runMonthlyReview = () => {
        executeWorkflow('MONTHLY_REVIEW');
    };

    const runUrgentTriage = () => {
        executeWorkflow('URGENT_CASE_TRIAGE');
    };

    const getWorkflowIcon = (workflowName) => {
        const icons = {
            'COMPREHENSIVE_CASE_REVIEW': <Assignment />,
            'DEBT_SOLUTION_COMPARISON': <Calculate />,
            'MONTHLY_REVIEW': <Timeline />,
            'URGENT_CASE_TRIAGE': <Speed />,
            'NEW_CLIENT_ONBOARDING': <Info />
        };
        return icons[workflowName] || <PlayArrow />;
    };

    const getStatusColor = (status) => {
        const colors = {
            'completed': 'success',
            'running': 'info',
            'failed': 'error',
            'pending': 'warning'
        };
        return colors[status] || 'default';
    };

    const WorkflowCard = ({ workflow, onExecute }) => (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" mb={2}>
                    {getWorkflowIcon(workflow.name)}
                    <Typography variant="h6" sx={{ ml: 1 }}>
                        {workflow.name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                    {workflow.description}
                </Typography>
                <Chip 
                    label={`${workflow.stepCount} steps`} 
                    size="small" 
                    variant="outlined" 
                />
            </CardContent>
            <Box p={2} pt={0}>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={() => onExecute(workflow.name)}
                    disabled={loading || !caseId}
                    startIcon={<PlayArrow />}
                >
                    Execute Workflow
                </Button>
            </Box>
        </Card>
    );

    const ExecutionResultsDialog = () => (
        <Dialog 
            open={resultsDialog} 
            onClose={() => setResultsDialog(false)}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle>Workflow Execution Results</DialogTitle>
            <DialogContent>
                {executionResults && (
                    <Box>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Workflow completed successfully!
                        </Alert>

                        {/* Comprehensive Review Results */}
                        {executionResults.analysis && (
                            <Accordion defaultExpanded>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Typography variant="h6">Case Analysis</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Grid container spacing={2}>
                                        {executionResults.analysis.budgetValidation && (
                                            <Grid item xs={12} md={6}>
                                                <Paper sx={{ p: 2 }}>
                                                    <Typography variant="subtitle1" gutterBottom>
                                                        Budget Validation
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        Total Income: £{executionResults.analysis.budgetValidation.totalIncome}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        Total Expenses: £{executionResults.analysis.budgetValidation.totalExpenses}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        Surplus/Deficit: £{executionResults.analysis.budgetValidation.surplus}
                                                    </Typography>
                                                    <Chip 
                                                        label={executionResults.analysis.budgetValidation.budgetHealth}
                                                        color={executionResults.analysis.budgetValidation.isBalanced ? 'success' : 'error'}
                                                        size="small"
                                                        sx={{ mt: 1 }}
                                                    />
                                                </Paper>
                                            </Grid>
                                        )}

                                        {executionResults.analysis.identifiedRisks && (
                                            <Grid item xs={12} md={6}>
                                                <Paper sx={{ p: 2 }}>
                                                    <Typography variant="subtitle1" gutterBottom>
                                                        Identified Risks
                                                    </Typography>
                                                    {executionResults.analysis.identifiedRisks.identifiedRisks?.map((risk, index) => (
                                                        <Alert 
                                                            key={index} 
                                                            severity={risk.severity === 'high' ? 'error' : 'warning'}
                                                            sx={{ mb: 1 }}
                                                        >
                                                            <Typography variant="body2">
                                                                <strong>{risk.type}:</strong> {risk.description}
                                                            </Typography>
                                                            <Typography variant="caption">
                                                                {risk.recommendation}
                                                            </Typography>
                                                        </Alert>
                                                    ))}
                                                </Paper>
                                            </Grid>
                                        )}

                                        {executionResults.analysis.criticalQuestions && (
                                            <Grid item xs={12}>
                                                <Paper sx={{ p: 2 }}>
                                                    <Typography variant="subtitle1" gutterBottom>
                                                        Critical Questions to Address
                                                    </Typography>
                                                    <List dense>
                                                        {executionResults.analysis.criticalQuestions.criticalQuestions?.map((question, index) => (
                                                            <ListItem key={index}>
                                                                <ListItemIcon>
                                                                    <QuestionAnswer color="primary" />
                                                                </ListItemIcon>
                                                                <ListItemText primary={question} />
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                </Paper>
                                            </Grid>
                                        )}

                                        {executionResults.analysis.recommendedSolutions && (
                                            <Grid item xs={12}>
                                                <Paper sx={{ p: 2 }}>
                                                    <Typography variant="subtitle1" gutterBottom>
                                                        Recommended Solutions
                                                    </Typography>
                                                    {executionResults.analysis.recommendedSolutions.recommendedSolutions?.map((solution, index) => (
                                                        <Card key={index} sx={{ mb: 1 }}>
                                                            <CardContent>
                                                                <Typography variant="subtitle2">
                                                                    {solution.type}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {solution.description}
                                                                </Typography>
                                                                <Box mt={1}>
                                                                    <Chip 
                                                                        label={`${solution.suitability} suitability`}
                                                                        color={solution.suitability === 'high' ? 'success' : 'default'}
                                                                        size="small"
                                                                    />
                                                                    {solution.estimatedDuration && (
                                                                        <Chip 
                                                                            label={solution.estimatedDuration}
                                                                            variant="outlined"
                                                                            size="small"
                                                                            sx={{ ml: 1 }}
                                                                        />
                                                                    )}
                                                                </Box>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </Paper>
                                            </Grid>
                                        )}
                                    </Grid>
                                </AccordionDetails>
                            </Accordion>
                        )}

                        {/* Generated Documents */}
                        {executionResults.generatedDocuments && (
                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMore />}>
                                    <Typography variant="h6">Generated Documents</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    {executionResults.generatedDocuments.confirmationLetter && (
                                        <Paper sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" gutterBottom>
                                                Confirmation of Advice Letter
                                            </Typography>
                                            <Box 
                                                sx={{ 
                                                    bgcolor: 'grey.50', 
                                                    p: 2, 
                                                    borderRadius: 1,
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.875rem',
                                                    whiteSpace: 'pre-wrap',
                                                    maxHeight: 400,
                                                    overflow: 'auto'
                                                }}
                                            >
                                                {executionResults.generatedDocuments.confirmationLetter}
                                            </Box>
                                            <Button 
                                                variant="outlined" 
                                                startIcon={<Description />}
                                                sx={{ mt: 2 }}
                                                onClick={() => {
                                                    const blob = new Blob([executionResults.generatedDocuments.confirmationLetter], 
                                                        { type: 'text/plain' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `confirmation-of-advice-case-${caseId}.txt`;
                                                    a.click();
                                                }}
                                            >
                                                Download Letter
                                            </Button>
                                        </Paper>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setResultsDialog(false)}>Close</Button>
            </DialogActions>
        </Dialog>
    );

    return (
        <Box>
            <Typography variant="h5" gutterBottom>
                Agentic Workflow Automation
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
                AI-powered workflow automation for comprehensive case analysis, risk assessment, 
                and document generation. Select a workflow to automate complex advice processes.
            </Typography>

            {!caseId && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    Select a case to enable workflow execution
                </Alert>
            )}

            {/* Quick Action Buttons */}
            <Box mb={3}>
                <Typography variant="h6" gutterBottom>
                    Quick Actions
                </Typography>
                <Grid container spacing={2}>
                    <Grid item>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={runComprehensiveReview}
                            disabled={loading || !caseId}
                            startIcon={loading ? <CircularProgress size={20} /> : <Assignment />}
                        >
                            Comprehensive Review
                        </Button>
                    </Grid>
                    <Grid item>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={runDebtComparison}
                            disabled={loading || !caseId}
                            startIcon={<Calculate />}
                        >
                            Compare Solutions
                        </Button>
                    </Grid>
                    <Grid item>
                        <Button
                            variant="outlined"
                            onClick={runMonthlyReview}
                            disabled={loading || !caseId}
                            startIcon={<Timeline />}
                        >
                            Monthly Review
                        </Button>
                    </Grid>
                    <Grid item>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={runUrgentTriage}
                            disabled={loading || !caseId}
                            startIcon={<Speed />}
                        >
                            Urgent Triage
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            {/* Available Workflows */}
            <Typography variant="h6" gutterBottom>
                Available Workflows
            </Typography>
            <Grid container spacing={3} mb={4}>
                {workflows.map((workflow) => (
                    <Grid item xs={12} md={6} lg={4} key={workflow.id}>
                        <WorkflowCard 
                            workflow={workflow} 
                            onExecute={(name) => executeWorkflow(name)}
                        />
                    </Grid>
                ))}
            </Grid>

            {/* Recent Executions */}
            {executions.length > 0 && (
                <Box>
                    <Typography variant="h6" gutterBottom>
                        Recent Executions
                    </Typography>
                    <List>
                        {executions.map((execution) => (
                            <ListItem key={execution.id} divider>
                                <ListItemIcon>
                                    {execution.status === 'completed' ? (
                                        <CheckCircle color="success" />
                                    ) : execution.status === 'failed' ? (
                                        <Error color="error" />
                                    ) : (
                                        <CircularProgress size={24} />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    primary={execution.workflowId}
                                    secondary={`Started: ${new Date(execution.started).toLocaleString()}`}
                                />
                                <Chip 
                                    label={execution.status} 
                                    color={getStatusColor(execution.status)}
                                    size="small"
                                />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

            <ExecutionResultsDialog />
        </Box>
    );
};

export default AgenticWorkflow;

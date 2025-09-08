# MCP & n8n Integration for Centre Managers

This document describes the implementation of MCP (Model Context Protocol) plugins and n8n workflow integration for CMA centre managers.

## Overview

The system provides centre managers with:
- **MCP Plugins**: Pre-built tools for accessing client files and centre statistics
- **n8n Integration**: Workflow automation platform integration with simple setup
- **Template Workflows**: 6 ready-to-use workflow templates for common tasks
- **Simple Interface**: User-friendly workflow creation without coding expertise

## Architecture

### MCP Plugins

Two specialized MCP plugins provide structured data access:

#### 1. Client Files MCP (`client-files-mcp.js`)
- **Purpose**: Secure access to client case files and documents
- **Location**: `server/mcp/client-files-mcp.js`
- **Capabilities**:
  - Get case file structure with organized folders
  - Advanced file search with filters
  - Automatic file organization using AI classification
  - File processing for AI workflows
  - Comprehensive file summary reports

**Available Tools**:
- `get_case_file_structure` - Get organized folder structure
- `search_case_files` - Search files with advanced filtering
- `auto_organize_files` - AI-powered file organization
- `get_file_for_processing` - Extract file content for AI
- `generate_file_summary_report` - Detailed file analytics

#### 2. Centre Statistics MCP (`centre-statistics-mcp.js`)
- **Purpose**: Performance analytics and operational insights
- **Location**: `server/mcp/centre-statistics-mcp.js`
- **Capabilities**:
  - Comprehensive centre dashboard metrics
  - Calendar and appointment analytics
  - Risk assessment across all cases
  - Operational insights with recommendations

**Available Tools**:
- `get_centre_dashboard_metrics` - Performance KPIs
- `get_calendar_analytics` - Appointment utilization
- `get_centre_risk_assessment` - Risk analysis
- `generate_operational_insights` - AI recommendations

### n8n Integration Layer

#### Integration Service (`server/routes/n8n-integration.js`)
- **Connection Management**: Test and monitor n8n connectivity
- **Template Management**: 6 pre-built workflow templates
- **Workflow Creation**: Simple point-and-click workflow creation
- **MCP Proxy**: Secure proxy for MCP tool access from n8n
- **Execution Tracking**: Monitor workflow performance

## Workflow Templates

### 1. Daily Case Review
- **Trigger**: Daily at 9:00 AM
- **Purpose**: Identify priority cases needing attention
- **Actions**: 
  - Get priority case analysis
  - Email summary to managers
  - Flag critical cases
- **Complexity**: Simple

### 2. Weekly Performance Report
- **Trigger**: Weekly on Friday at 5:00 PM
- **Purpose**: Generate comprehensive performance analytics
- **Actions**:
  - Collect centre metrics
  - Generate performance report
  - Email to management team
- **Complexity**: Simple

### 3. Client Document Processor
- **Trigger**: File upload events
- **Purpose**: Automatically organize uploaded documents
- **Actions**:
  - Classify document types
  - Move to appropriate folders
  - Log organization results
- **Complexity**: Medium

### 4. Appointment Reminder System
- **Trigger**: Daily at 12:00 PM and 6:00 PM
- **Purpose**: Reduce no-shows with automated reminders
- **Actions**:
  - Find appointments for next day
  - Send client SMS/email reminders
  - Notify staff of preparations needed
- **Complexity**: Medium

### 5. FCA Compliance Monitor
- **Trigger**: Daily at 6:00 AM
- **Purpose**: Proactive compliance monitoring
- **Actions**:
  - Scan all cases for compliance issues
  - Generate compliance report
  - Alert on high-risk issues
- **Complexity**: Advanced

### 6. Staff Workload Balancer
- **Trigger**: Daily at 8:00 AM
- **Purpose**: Optimize staff workload distribution
- **Actions**:
  - Analyze current workloads
  - Identify overloaded advisors
  - Suggest case redistributions
- **Complexity**: Advanced

## Database Schema

### Core Tables (`sql/n8n-workflow-schema.sql`)

- **n8n_workflows**: Track created workflows
- **n8n_workflow_executions**: Log all executions with performance
- **mcp_plugin_usage**: Track MCP plugin usage analytics
- **workflow_template_analytics**: Template performance metrics
- **workflow_schedules**: Scheduling configuration
- **workflow_permissions**: Access control
- **workflow_notifications**: Alert settings

## User Interface

### WorkflowManager Component (`src/components/WorkflowManager.js`)
- **Setup Guide**: Step-by-step n8n installation and configuration
- **Template Gallery**: Visual workflow template selection
- **Status Monitoring**: Real-time workflow status and metrics
- **Simple Creation**: One-click workflow creation from templates
- **No Coding Required**: User-friendly interface for centre managers

## API Endpoints

### n8n Integration (`/api/n8n`)
- `GET /status` - Test n8n connection
- `GET /templates` - Get available workflow templates
- `POST /workflows/create` - Create workflow from template
- `GET /workflows` - Get centre workflows
- `GET /mcp/tools` - Get available MCP tools

### MCP Proxy (`/api/n8n/mcp/:tool_name`)
- Secure proxy for n8n to access MCP tools
- Authentication and authorization
- Usage tracking and analytics

## Setup Instructions

### 1. Install n8n
```bash
npm install n8n -g
n8n start
```

### 2. Configure Environment Variables
```env
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
API_BASE_URL=http://localhost:3000
```

### 3. Run Database Migration
```sql
-- Execute the schema file
psql -d your_database -f sql/n8n-workflow-schema.sql
```

### 4. Access Workflow Manager
- Navigate to `/workflow-automation` in the CMA system
- Follow the setup guide for first-time configuration
- Select templates and create workflows

## Security Considerations

### Access Control
- Only centre managers can create/manage workflows
- MCP tools verify case access permissions
- Workflow permissions can be granularly controlled

### Data Protection
- All MCP tool calls are logged for audit
- Sensitive data is never exposed in workflow logs
- API calls use JWT authentication

### Network Security
- n8n should be on private network or secured
- API endpoints use HTTPS in production
- Webhook endpoints are secured with tokens

## Benefits for Centre Managers

### Automation Without Coding
- Pre-built templates for common tasks
- Visual workflow builder (n8n interface)
- Simple setup process with guidance

### Operational Efficiency
- Automated daily/weekly reports
- Proactive issue identification
- Staff workload optimization

### Compliance Assurance
- Automated FCA compliance monitoring
- Systematic case reviews
- Audit trail for all actions

### Better Client Service
- Appointment reminder automation
- Faster document processing
- Priority case identification

## Troubleshooting

### Common Issues

1. **n8n Connection Failed**
   - Check n8n is running on correct port
   - Verify N8N_BASE_URL environment variable
   - Test network connectivity

2. **Workflow Creation Fails**
   - Ensure n8n API key is configured
   - Check user has manager role
   - Verify database connectivity

3. **MCP Tools Not Working**
   - Check case access permissions
   - Verify API authentication tokens
   - Review MCP plugin logs

### Monitoring

- Use `/api/n8n/status` to test connectivity
- Check workflow execution logs in database
- Monitor MCP plugin usage statistics
- Review workflow performance metrics

## Future Enhancements

### Planned Features
- Custom workflow builder for advanced users
- Integration with external systems (CRM, accounting)
- Mobile notifications for critical alerts
- Advanced analytics and reporting

### Community Workflows
- Workflow sharing between centres
- Community template repository
- Best practice documentation

This integration provides centre managers with powerful automation capabilities while maintaining simplicity and security. The system is designed to be deployed gradually, starting with simple templates and expanding based on user needs and expertise.
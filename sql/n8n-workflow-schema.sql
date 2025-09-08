-- n8n Workflow Integration Database Schema
-- Tracks workflows created through the CMA system and their execution history

-- Table to track n8n workflows created by centre managers
CREATE TABLE IF NOT EXISTS n8n_workflows (
    id SERIAL PRIMARY KEY,
    n8n_workflow_id VARCHAR(50) NOT NULL UNIQUE, -- n8n's internal workflow ID
    template_id VARCHAR(100) NOT NULL,           -- Template used to create the workflow
    centre_id INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    workflow_name VARCHAR(255) NOT NULL,         -- Custom name given by user
    description TEXT,                            -- Workflow description
    configuration JSONB,                         -- Custom configuration parameters
    status VARCHAR(50) DEFAULT 'active',        -- active, inactive, error
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_executed_at TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    -- Indexes for performance
    INDEX idx_n8n_workflows_centre_id (centre_id),
    INDEX idx_n8n_workflows_template_id (template_id),
    INDEX idx_n8n_workflows_status (status)
);

-- Table to log workflow executions and results
CREATE TABLE IF NOT EXISTS n8n_workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES n8n_workflows(id) ON DELETE CASCADE,
    n8n_execution_id VARCHAR(50),               -- n8n's internal execution ID
    execution_status VARCHAR(50) NOT NULL,      -- success, error, running, waiting
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    
    -- Execution details
    trigger_type VARCHAR(50),                    -- schedule, webhook, manual
    input_data JSONB,                           -- Input parameters passed to workflow
    output_data JSONB,                          -- Results returned by workflow
    error_message TEXT,                         -- Error details if execution failed
    
    -- Metrics
    nodes_executed INTEGER DEFAULT 0,
    nodes_failed INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_executions_workflow_id (workflow_id),
    INDEX idx_executions_status (execution_status),
    INDEX idx_executions_started_at (started_at)
);

-- Table to store MCP plugin usage statistics
CREATE TABLE IF NOT EXISTS mcp_plugin_usage (
    id SERIAL PRIMARY KEY,
    plugin_name VARCHAR(100) NOT NULL,          -- client-files-mcp, centre-statistics-mcp
    tool_name VARCHAR(100) NOT NULL,            -- Specific tool called
    centre_id INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    -- Execution details
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Request/Response details
    input_parameters JSONB,
    output_size_bytes INTEGER,
    records_processed INTEGER,
    
    -- Context
    triggered_by VARCHAR(50),                   -- n8n-workflow, manual, api-call
    workflow_execution_id INTEGER REFERENCES n8n_workflow_executions(id),
    
    -- Indexes
    INDEX idx_mcp_usage_centre_id (centre_id),
    INDEX idx_mcp_usage_plugin_tool (plugin_name, tool_name),
    INDEX idx_mcp_usage_executed_at (executed_at)
);

-- Table to track workflow template performance and popularity
CREATE TABLE IF NOT EXISTS workflow_template_analytics (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(100) NOT NULL,
    centre_id INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
    
    -- Usage statistics
    total_workflows_created INTEGER DEFAULT 0,
    active_workflows INTEGER DEFAULT 0,
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_execution_time_seconds DECIMAL(10,2),
    avg_success_rate DECIMAL(5,2),
    avg_data_processed INTEGER,
    
    -- Time tracking
    first_created_at TIMESTAMP,
    last_executed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(template_id, centre_id),
    
    -- Indexes
    INDEX idx_template_analytics_template_id (template_id),
    INDEX idx_template_analytics_centre_id (centre_id)
);

-- Table to store workflow scheduling preferences
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES n8n_workflows(id) ON DELETE CASCADE,
    
    -- Schedule configuration
    schedule_type VARCHAR(50) NOT NULL,         -- cron, interval, webhook
    schedule_config JSONB NOT NULL,             -- Cron expression or interval config
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    next_execution_at TIMESTAMP,
    last_execution_at TIMESTAMP,
    
    -- Settings
    max_concurrent_executions INTEGER DEFAULT 1,
    retry_on_failure BOOLEAN DEFAULT TRUE,
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 300,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_schedules_workflow_id (workflow_id),
    INDEX idx_schedules_next_execution (next_execution_at),
    INDEX idx_schedules_active (is_active)
);

-- Table to manage workflow permissions and sharing
CREATE TABLE IF NOT EXISTS workflow_permissions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES n8n_workflows(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_name VARCHAR(50),                      -- Alternative to user_id for role-based access
    
    -- Permissions
    can_view BOOLEAN DEFAULT TRUE,
    can_execute BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_share BOOLEAN DEFAULT FALSE,
    
    granted_by INTEGER NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either user_id or role_name is specified
    CHECK ((user_id IS NOT NULL AND role_name IS NULL) OR 
           (user_id IS NULL AND role_name IS NOT NULL)),
    
    -- Indexes
    INDEX idx_permissions_workflow_id (workflow_id),
    INDEX idx_permissions_user_id (user_id),
    INDEX idx_permissions_role_name (role_name)
);

-- Table to store workflow notifications and alerts
CREATE TABLE IF NOT EXISTS workflow_notifications (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES n8n_workflows(id) ON DELETE CASCADE,
    
    -- Notification triggers
    on_success BOOLEAN DEFAULT FALSE,
    on_failure BOOLEAN DEFAULT TRUE,
    on_long_running BOOLEAN DEFAULT FALSE,      -- If execution takes longer than expected
    long_running_threshold_seconds INTEGER DEFAULT 3600,
    
    -- Recipients
    notify_creator BOOLEAN DEFAULT TRUE,
    notify_centre_managers BOOLEAN DEFAULT FALSE,
    additional_recipients TEXT[],               -- Email addresses
    
    -- Notification methods
    email_notifications BOOLEAN DEFAULT TRUE,
    in_app_notifications BOOLEAN DEFAULT TRUE,
    slack_webhook_url VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_notifications_workflow_id (workflow_id)
);

-- Function to update workflow analytics
CREATE OR REPLACE FUNCTION update_workflow_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update template analytics when execution completes
    IF NEW.execution_status IN ('success', 'error') AND 
       (OLD.execution_status IS NULL OR OLD.execution_status NOT IN ('success', 'error')) THEN
        
        INSERT INTO workflow_template_analytics (
            template_id,
            centre_id,
            total_executions,
            successful_executions,
            failed_executions,
            last_executed_at
        )
        SELECT 
            w.template_id,
            w.centre_id,
            1,
            CASE WHEN NEW.execution_status = 'success' THEN 1 ELSE 0 END,
            CASE WHEN NEW.execution_status = 'error' THEN 1 ELSE 0 END,
            NEW.completed_at
        FROM n8n_workflows w
        WHERE w.id = NEW.workflow_id
        ON CONFLICT (template_id, centre_id) DO UPDATE SET
            total_executions = workflow_template_analytics.total_executions + 1,
            successful_executions = workflow_template_analytics.successful_executions + 
                CASE WHEN NEW.execution_status = 'success' THEN 1 ELSE 0 END,
            failed_executions = workflow_template_analytics.failed_executions + 
                CASE WHEN NEW.execution_status = 'error' THEN 1 ELSE 0 END,
            last_executed_at = NEW.completed_at,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update analytics
CREATE TRIGGER trigger_update_workflow_analytics
    AFTER INSERT OR UPDATE ON n8n_workflow_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_analytics();

-- Function to clean old execution logs (keep last 1000 per workflow)
CREATE OR REPLACE FUNCTION cleanup_old_executions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Keep only the most recent 1000 executions per workflow
    WITH old_executions AS (
        SELECT id
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY workflow_id ORDER BY started_at DESC) as rn
            FROM n8n_workflow_executions
        ) ranked
        WHERE rn > 1000
    )
    DELETE FROM n8n_workflow_executions 
    WHERE id IN (SELECT id FROM old_executions);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for workflow dashboard
CREATE OR REPLACE VIEW workflow_dashboard AS
SELECT 
    w.id,
    w.workflow_name,
    w.template_id,
    w.centre_id,
    w.status,
    w.created_at,
    w.execution_count,
    w.error_count,
    w.last_executed_at,
    
    -- Recent execution status
    (SELECT execution_status FROM n8n_workflow_executions 
     WHERE workflow_id = w.id 
     ORDER BY started_at DESC LIMIT 1) as last_execution_status,
    
    -- Success rate
    CASE 
        WHEN w.execution_count > 0 THEN 
            ROUND(((w.execution_count - w.error_count)::DECIMAL / w.execution_count * 100), 2)
        ELSE NULL 
    END as success_rate,
    
    -- Creator info
    u.first_name as creator_first_name,
    u.last_name as creator_last_name,
    
    -- Centre info
    c.name as centre_name
    
FROM n8n_workflows w
LEFT JOIN users u ON w.created_by = u.id
LEFT JOIN centres c ON w.centre_id = c.id;

-- Initial data: Insert default workflow templates if they don't exist
INSERT INTO workflow_template_analytics (template_id, centre_id, total_workflows_created, active_workflows)
SELECT 
    template_ids.id,
    c.id,
    0,
    0
FROM centres c
CROSS JOIN (VALUES 
    ('daily-case-review'),
    ('weekly-performance-report'),
    ('client-document-processor'),
    ('appointment-reminder-system'),
    ('compliance-monitor'),
    ('staff-workload-balancer')
) AS template_ids(id)
ON CONFLICT (template_id, centre_id) DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE n8n_workflows IS 'Tracks n8n workflows created through the CMA system';
COMMENT ON TABLE n8n_workflow_executions IS 'Logs all workflow executions with performance metrics';
COMMENT ON TABLE mcp_plugin_usage IS 'Tracks usage of MCP plugins for analytics';
COMMENT ON TABLE workflow_template_analytics IS 'Performance analytics for workflow templates';
COMMENT ON VIEW workflow_dashboard IS 'Dashboard view combining workflow and execution data';
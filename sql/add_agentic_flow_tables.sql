-- Add tables to support agentic workflow tracking and management

-- Table for tracking agentic flow executions
CREATE TABLE IF NOT EXISTS agentic_flow_executions (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    flow_id VARCHAR(255) NOT NULL,
    executed_by INTEGER NOT NULL REFERENCES users(id),
    execution_status VARCHAR(50) DEFAULT 'completed',
    result_summary JSONB,
    execution_duration_seconds INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agentic_executions_centre (centre_id),
    INDEX idx_agentic_executions_flow (flow_id),
    INDEX idx_agentic_executions_date (executed_at)
);

-- Table for storing workflow templates and configurations
CREATE TABLE IF NOT EXISTS agentic_workflow_templates (
    id SERIAL PRIMARY KEY,
    flow_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    complexity VARCHAR(50), -- 'Simple', 'Medium', 'Complex'
    estimated_duration_minutes INTEGER,
    mcp_tools JSONB, -- Array of MCP tools used
    parameters_schema JSONB, -- JSON schema for workflow parameters
    demo_available BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default workflow templates
INSERT INTO agentic_workflow_templates (flow_id, name, description, category, complexity, estimated_duration_minutes, mcp_tools, demo_available) VALUES
('monthly-centre-report', 'Monthly Centre Report', 'Generate comprehensive monthly performance report with AI insights and recommendations', 'Reporting', 'Simple', 5, '["centre_statistics", "case_analytics", "staff_performance", "compliance_check"]', true),
('staff-workload-optimizer', 'Staff Workload Optimizer', 'Analyze and optimize case distribution across advisors based on capacity and expertise', 'Operations', 'Medium', 4, '["staff_analysis", "case_complexity_scoring", "workload_calculator", "skill_matching"]', true),
('priority-case-triage', 'Priority Case Triage', 'Automatically identify high-risk cases requiring immediate attention', 'Risk Management', 'Simple', 2, '["vulnerability_scanner", "debt_risk_analyzer", "priority_scoring", "urgent_action_generator"]', true),
('batch-letter-generation', 'Batch Letter Generation', 'Generate multiple personalized confirmation letters using local AI', 'Documentation', 'Medium', 8, '["bulk_coa_generator", "letter_templating", "brand_application", "quality_checker"]', false),
('compliance-audit-runner', 'Compliance Audit Runner', 'Comprehensive FCA compliance check with gap analysis and remediation planning', 'Compliance', 'Complex', 15, '["fca_compliance_checker", "data_completeness_validator", "audit_trail_analyzer", "remediation_planner"]', false),
('multilingual-client-outreach', 'Multilingual Client Outreach', 'Generate personalized client communications in multiple languages using local translation', 'Communication', 'Medium', 7, '["client_segmentation", "message_templating", "local_translator", "delivery_scheduler"]', true);

-- Table for tracking workflow performance metrics
CREATE TABLE IF NOT EXISTS workflow_performance_metrics (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    flow_id VARCHAR(255) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(10,2),
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_workflow_metrics_centre (centre_id),
    INDEX idx_workflow_metrics_flow (flow_id),
    INDEX idx_workflow_metrics_date (measured_at)
);

-- Table for AI-generated insights and recommendations
CREATE TABLE IF NOT EXISTS ai_insights (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    insight_type VARCHAR(100) NOT NULL, -- 'workload_optimization', 'risk_assessment', 'performance_trend', etc.
    insight_content TEXT NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    related_cases JSONB, -- Array of case IDs this insight relates to
    action_required BOOLEAN DEFAULT false,
    action_deadline DATE,
    created_by_workflow VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'actioned', 'dismissed'
    INDEX idx_insights_centre (centre_id),
    INDEX idx_insights_type (insight_type),
    INDEX idx_insights_status (status)
);

-- Table for workflow demo tracking and feedback
CREATE TABLE IF NOT EXISTS workflow_demo_sessions (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    flow_id VARCHAR(255) NOT NULL,
    demo_completed BOOLEAN DEFAULT false,
    feedback_rating INTEGER, -- 1-5 star rating
    feedback_comments TEXT,
    time_to_complete_seconds INTEGER,
    converted_to_real_execution BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_demo_sessions_centre (centre_id),
    INDEX idx_demo_sessions_flow (flow_id)
);

-- Table for storing centre-specific workflow configurations
CREATE TABLE IF NOT EXISTS centre_workflow_configs (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    flow_id VARCHAR(255) NOT NULL,
    custom_parameters JSONB,
    is_enabled BOOLEAN DEFAULT true,
    auto_schedule BOOLEAN DEFAULT false,
    schedule_cron VARCHAR(255), -- For automated scheduling
    last_executed TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(centre_id, flow_id),
    INDEX idx_centre_configs_centre (centre_id),
    INDEX idx_centre_configs_enabled (is_enabled)
);

-- Add initial configurations for all centres
INSERT INTO centre_workflow_configs (centre_id, flow_id, custom_parameters, is_enabled)
SELECT 
    c.id,
    wt.flow_id,
    '{}',
    true
FROM centres c
CROSS JOIN agentic_workflow_templates wt
WHERE NOT EXISTS (
    SELECT 1 FROM centre_workflow_configs cwc 
    WHERE cwc.centre_id = c.id AND cwc.flow_id = wt.flow_id
);

-- Function to record workflow execution metrics
CREATE OR REPLACE FUNCTION record_workflow_execution(
    p_centre_id INTEGER,
    p_flow_id VARCHAR(255),
    p_user_id INTEGER,
    p_duration_seconds INTEGER,
    p_result_summary JSONB
) RETURNS VOID AS $$
BEGIN
    INSERT INTO agentic_flow_executions (
        centre_id, flow_id, executed_by, execution_duration_seconds, result_summary
    ) VALUES (
        p_centre_id, p_flow_id, p_user_id, p_duration_seconds, p_result_summary
    );
    
    -- Update last executed time in centre config
    UPDATE centre_workflow_configs 
    SET last_executed = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE centre_id = p_centre_id AND flow_id = p_flow_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get centre workflow statistics
CREATE OR REPLACE FUNCTION get_centre_workflow_stats(p_centre_id INTEGER)
RETURNS TABLE (
    total_executions BIGINT,
    avg_duration_minutes DECIMAL,
    most_used_flow VARCHAR(255),
    time_saved_hours DECIMAL,
    last_execution TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_executions,
        ROUND(AVG(execution_duration_seconds::DECIMAL / 60), 1) as avg_duration_minutes,
        (SELECT flow_id FROM agentic_flow_executions WHERE centre_id = p_centre_id GROUP BY flow_id ORDER BY COUNT(*) DESC LIMIT 1) as most_used_flow,
        ROUND(COUNT(*) * 2.5, 1) as time_saved_hours, -- Average 2.5 hours saved per execution
        MAX(executed_at) as last_execution
    FROM agentic_flow_executions 
    WHERE centre_id = p_centre_id;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_centre_status ON cases(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_case_created ON notes(case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_centre_active ON users(centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_appointments_case_date ON appointments(case_id, appointment_date);
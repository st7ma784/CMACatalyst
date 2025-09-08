/**
 * MCP Plugin for Centre Statistics and Calendar Information
 * Provides comprehensive analytics, performance metrics, and calendar data
 * for AI workflows and n8n integrations
 */

const pool = require('../config/database');
const dayjs = require('dayjs');

class CentreStatisticsMCP {
    constructor() {
        this.pluginName = 'centre-statistics-mcp';
        this.version = '1.0.0';
        this.description = 'MCP plugin for centre statistics, performance analytics, and calendar information';
    }

    /**
     * Get comprehensive centre dashboard metrics
     */
    async getCentreDashboardMetrics(centreId, timeframe = 'month') {
        try {
            const client = await pool.connect();
            
            // Calculate date ranges based on timeframe
            const ranges = this.calculateDateRanges(timeframe);
            
            // Get core metrics
            const coreMetrics = await client.query(`
                SELECT 
                    -- Case metrics
                    COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_cases,
                    COUNT(CASE WHEN c.created_at >= $2 THEN 1 END) as new_cases_period,
                    COUNT(CASE WHEN c.status = 'closed' AND c.closed_at >= $2 THEN 1 END) as closed_cases_period,
                    
                    -- Financial metrics
                    COALESCE(SUM(CASE WHEN c.status = 'active' THEN c.total_debt END), 0) as total_debt_managed,
                    COALESCE(AVG(CASE WHEN c.status = 'active' THEN c.total_debt END), 0) as avg_case_debt,
                    
                    -- Performance metrics
                    COALESCE(AVG(CASE WHEN c.status = 'closed' THEN EXTRACT(EPOCH FROM (c.closed_at - c.created_at))/86400 END), 0) as avg_case_duration_days,
                    
                    -- Staff metrics
                    (SELECT COUNT(*) FROM users WHERE centre_id = $1 AND is_active = true) as total_staff,
                    (SELECT COUNT(*) FROM users WHERE centre_id = $1 AND is_active = true AND role = 'advisor') as active_advisors,
                    
                    -- Activity metrics
                    (SELECT COUNT(*) FROM notes WHERE case_id IN (SELECT id FROM cases WHERE centre_id = $1) AND created_at >= $2) as notes_period,
                    (SELECT COUNT(*) FROM appointments WHERE case_id IN (SELECT id FROM cases WHERE centre_id = $1) AND appointment_date >= $3) as upcoming_appointments
                FROM cases c
                WHERE c.centre_id = $1
            `, [centreId, ranges.periodStart, ranges.futureStart]);

            // Get workload distribution
            const workloadStats = await client.query(`
                SELECT 
                    u.id, u.first_name, u.last_name, u.role,
                    COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_cases,
                    COUNT(CASE WHEN c.status = 'closed' AND c.closed_at >= $2 THEN 1 END) as closed_cases_period,
                    COUNT(CASE WHEN a.appointment_date >= $3 THEN 1 END) as upcoming_appointments_count,
                    AVG(CASE WHEN c.status = 'closed' AND c.closed_at >= $2 THEN EXTRACT(EPOCH FROM (c.closed_at - c.created_at))/86400 END) as avg_resolution_days
                FROM users u
                LEFT JOIN cases c ON u.id = c.assigned_advisor_id
                LEFT JOIN appointments a ON u.id = a.advisor_id AND a.status != 'cancelled'
                WHERE u.centre_id = $1 AND u.is_active = true AND u.role IN ('advisor', 'manager')
                GROUP BY u.id, u.first_name, u.last_name, u.role
                ORDER BY active_cases DESC
            `, [centreId, ranges.periodStart, ranges.futureStart]);

            // Get performance trends
            const trendData = await client.query(`
                SELECT 
                    DATE_TRUNC('week', created_at) as week,
                    COUNT(*) as cases_created,
                    COUNT(CASE WHEN status = 'closed' THEN 1 END) as cases_closed,
                    AVG(total_debt) as avg_debt
                FROM cases
                WHERE centre_id = $1 AND created_at >= $2
                GROUP BY DATE_TRUNC('week', created_at)
                ORDER BY week
            `, [centreId, ranges.trendStart]);

            client.release();

            const metrics = coreMetrics.rows[0];
            
            return {
                centre_id: centreId,
                timeframe,
                period: {
                    start: ranges.periodStart,
                    end: ranges.periodEnd
                },
                overview: {
                    active_cases: parseInt(metrics.active_cases),
                    new_cases: parseInt(metrics.new_cases_period),
                    closed_cases: parseInt(metrics.closed_cases_period),
                    case_closure_rate: metrics.new_cases_period > 0 ? 
                        Math.round((metrics.closed_cases_period / metrics.new_cases_period) * 100) : 0,
                    total_debt_managed: parseFloat(metrics.total_debt_managed),
                    avg_case_debt: Math.round(parseFloat(metrics.avg_case_debt)),
                    avg_resolution_days: Math.round(parseFloat(metrics.avg_case_duration_days)),
                    upcoming_appointments: parseInt(metrics.upcoming_appointments)
                },
                staff: {
                    total_staff: parseInt(metrics.total_staff),
                    active_advisors: parseInt(metrics.active_advisors),
                    notes_created: parseInt(metrics.notes_period),
                    workload_distribution: workloadStats.rows.map(staff => ({
                        ...staff,
                        active_cases: parseInt(staff.active_cases),
                        closed_cases_period: parseInt(staff.closed_cases_period),
                        upcoming_appointments: parseInt(staff.upcoming_appointments_count),
                        avg_resolution_days: Math.round(parseFloat(staff.avg_resolution_days) || 0),
                        workload_score: this.calculateWorkloadScore(staff)
                    }))
                },
                trends: {
                    weekly_data: trendData.rows.map(week => ({
                        week: week.week,
                        cases_created: parseInt(week.cases_created),
                        cases_closed: parseInt(week.cases_closed),
                        avg_debt: Math.round(parseFloat(week.avg_debt) || 0),
                        net_change: parseInt(week.cases_created) - parseInt(week.cases_closed)
                    }))
                },
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting centre dashboard metrics:', error);
            throw error;
        }
    }

    /**
     * Get calendar analytics and scheduling insights
     */
    async getCalendarAnalytics(centreId, timeframe = 'month') {
        try {
            const client = await pool.connect();
            const ranges = this.calculateDateRanges(timeframe);

            // Appointment statistics
            const appointmentStats = await client.query(`
                SELECT 
                    COUNT(*) as total_appointments,
                    COUNT(CASE WHEN a.status = 'scheduled' THEN 1 END) as scheduled,
                    COUNT(CASE WHEN a.status = 'confirmed' THEN 1 END) as confirmed,
                    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled,
                    COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_shows,
                    AVG(a.duration_minutes) as avg_duration,
                    
                    -- Future appointments
                    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE THEN 1 END) as future_appointments,
                    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE AND a.appointment_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as next_7_days,
                    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE AND a.appointment_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as next_30_days
                FROM appointments a
                JOIN cases c ON a.case_id = c.id
                WHERE c.centre_id = $1 AND a.appointment_date >= $2 AND a.appointment_date <= $3
            `, [centreId, ranges.periodStart, ranges.periodEnd]);

            // Daily appointment distribution
            const dailyDistribution = await client.query(`
                SELECT 
                    DATE(a.appointment_date) as date,
                    COUNT(*) as appointment_count,
                    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count,
                    COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_show_count,
                    EXTRACT(DOW FROM a.appointment_date) as day_of_week,
                    SUM(a.duration_minutes) as total_duration_minutes
                FROM appointments a
                JOIN cases c ON a.case_id = c.id
                WHERE c.centre_id = $1 AND a.appointment_date >= $2 AND a.appointment_date <= $3
                GROUP BY DATE(a.appointment_date), EXTRACT(DOW FROM a.appointment_date)
                ORDER BY date
            `, [centreId, ranges.periodStart, ranges.periodEnd]);

            // Advisor utilization
            const advisorUtilization = await client.query(`
                SELECT 
                    u.id, u.first_name, u.last_name,
                    COUNT(a.id) as total_appointments,
                    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
                    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE THEN 1 END) as future_appointments,
                    SUM(CASE WHEN a.status = 'completed' THEN a.duration_minutes ELSE 0 END) as total_client_time_minutes,
                    AVG(CASE WHEN a.status = 'completed' THEN a.duration_minutes END) as avg_appointment_duration,
                    COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_shows
                FROM users u
                LEFT JOIN appointments a ON u.id = a.advisor_id
                LEFT JOIN cases c ON a.case_id = c.id AND c.centre_id = $1
                WHERE u.centre_id = $1 AND u.role = 'advisor' AND u.is_active = true
                AND (a.appointment_date IS NULL OR (a.appointment_date >= $2 AND a.appointment_date <= $3))
                GROUP BY u.id, u.first_name, u.last_name
                ORDER BY total_appointments DESC
            `, [centreId, ranges.periodStart, ranges.periodEnd]);

            // Peak time analysis
            const peakTimes = await client.query(`
                SELECT 
                    EXTRACT(HOUR FROM a.appointment_date) as hour,
                    EXTRACT(DOW FROM a.appointment_date) as day_of_week,
                    COUNT(*) as appointment_count
                FROM appointments a
                JOIN cases c ON a.case_id = c.id
                WHERE c.centre_id = $1 AND a.appointment_date >= $2 AND a.appointment_date <= $3
                GROUP BY EXTRACT(HOUR FROM a.appointment_date), EXTRACT(DOW FROM a.appointment_date)
                ORDER BY appointment_count DESC
            `, [centreId, ranges.periodStart, ranges.periodEnd]);

            client.release();

            const stats = appointmentStats.rows[0];
            
            return {
                centre_id: centreId,
                timeframe,
                period: {
                    start: ranges.periodStart,
                    end: ranges.periodEnd
                },
                summary: {
                    total_appointments: parseInt(stats.total_appointments),
                    completion_rate: stats.total_appointments > 0 ? 
                        Math.round((stats.completed / stats.total_appointments) * 100) : 0,
                    no_show_rate: stats.total_appointments > 0 ? 
                        Math.round((stats.no_shows / stats.total_appointments) * 100) : 0,
                    avg_duration: Math.round(parseFloat(stats.avg_duration) || 0),
                    future_appointments: parseInt(stats.future_appointments),
                    next_7_days: parseInt(stats.next_7_days),
                    next_30_days: parseInt(stats.next_30_days)
                },
                status_breakdown: {
                    scheduled: parseInt(stats.scheduled),
                    confirmed: parseInt(stats.confirmed),
                    completed: parseInt(stats.completed),
                    cancelled: parseInt(stats.cancelled),
                    no_shows: parseInt(stats.no_shows)
                },
                daily_distribution: dailyDistribution.rows.map(day => ({
                    date: day.date,
                    appointment_count: parseInt(day.appointment_count),
                    completed_count: parseInt(day.completed_count),
                    no_show_count: parseInt(day.no_show_count),
                    day_of_week: this.getDayName(day.day_of_week),
                    total_duration_hours: Math.round(parseFloat(day.total_duration_minutes) / 60 * 10) / 10,
                    utilization_rate: day.appointment_count > 0 ? 
                        Math.round((day.completed_count / day.appointment_count) * 100) : 0
                })),
                advisor_utilization: advisorUtilization.rows.map(advisor => ({
                    advisor_id: advisor.id,
                    name: `${advisor.first_name} ${advisor.last_name}`,
                    total_appointments: parseInt(advisor.total_appointments || 0),
                    completed_appointments: parseInt(advisor.completed_appointments || 0),
                    future_appointments: parseInt(advisor.future_appointments || 0),
                    completion_rate: advisor.total_appointments > 0 ? 
                        Math.round((advisor.completed_appointments / advisor.total_appointments) * 100) : 0,
                    total_client_time_hours: Math.round(parseFloat(advisor.total_client_time_minutes || 0) / 60 * 10) / 10,
                    avg_appointment_duration: Math.round(parseFloat(advisor.avg_appointment_duration) || 0),
                    no_shows: parseInt(advisor.no_shows || 0),
                    availability_score: this.calculateAvailabilityScore(advisor)
                })),
                peak_analysis: {
                    busiest_hours: peakTimes.rows
                        .reduce((acc, curr) => {
                            const existing = acc.find(item => item.hour === parseInt(curr.hour));
                            if (existing) {
                                existing.total_appointments += parseInt(curr.appointment_count);
                            } else {
                                acc.push({
                                    hour: parseInt(curr.hour),
                                    total_appointments: parseInt(curr.appointment_count)
                                });
                            }
                            return acc;
                        }, [])
                        .sort((a, b) => b.total_appointments - a.total_appointments)
                        .slice(0, 5),
                    busiest_days: peakTimes.rows
                        .reduce((acc, curr) => {
                            const existing = acc.find(item => item.day_of_week === parseInt(curr.day_of_week));
                            if (existing) {
                                existing.total_appointments += parseInt(curr.appointment_count);
                            } else {
                                acc.push({
                                    day_of_week: parseInt(curr.day_of_week),
                                    day_name: this.getDayName(curr.day_of_week),
                                    total_appointments: parseInt(curr.appointment_count)
                                });
                            }
                            return acc;
                        }, [])
                        .sort((a, b) => b.total_appointments - a.total_appointments)
                },
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting calendar analytics:', error);
            throw error;
        }
    }

    /**
     * Get risk assessment metrics across the centre
     */
    async getCentreRiskAssessment(centreId) {
        try {
            const client = await pool.connect();

            // Priority debt analysis
            const debtAnalysis = await client.query(`
                SELECT 
                    COUNT(CASE WHEN cr.priority_type = 'priority' THEN 1 END) as priority_debts,
                    COUNT(CASE WHEN cr.priority_type = 'non_priority' THEN 1 END) as non_priority_debts,
                    SUM(CASE WHEN cr.priority_type = 'priority' THEN cr.amount_owed ELSE 0 END) as priority_debt_total,
                    SUM(CASE WHEN cr.priority_type = 'non_priority' THEN cr.amount_owed ELSE 0 END) as non_priority_debt_total,
                    
                    -- High-risk cases
                    COUNT(CASE WHEN c.total_debt > 50000 THEN 1 END) as high_debt_cases,
                    COUNT(CASE WHEN c.status = 'active' AND c.created_at < CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as stale_cases,
                    
                    -- Vulnerability indicators
                    (SELECT COUNT(DISTINCT n.case_id) FROM notes n 
                     WHERE n.case_id IN (SELECT id FROM cases WHERE centre_id = $1) 
                     AND n.note_category = 'vulnerability') as cases_with_vulnerability,
                    
                    -- Legal action risks
                    (SELECT COUNT(DISTINCT cr.case_id) FROM creditors cr 
                     WHERE cr.case_id IN (SELECT id FROM cases WHERE centre_id = $1) 
                     AND cr.enforcement_action = true) as cases_with_enforcement
                FROM cases c
                LEFT JOIN creditors cr ON c.id = cr.case_id
                WHERE c.centre_id = $1 AND c.status = 'active'
            `, [centreId]);

            // Case priority scoring
            const casePriorities = await client.query(`
                SELECT 
                    c.id, c.case_number, c.total_debt, c.created_at,
                    cl.first_name, cl.last_name,
                    (SELECT COUNT(*) FROM creditors WHERE case_id = c.id AND priority_type = 'priority') as priority_creditors,
                    (SELECT COUNT(*) FROM creditors WHERE case_id = c.id AND enforcement_action = true) as enforcement_actions,
                    (SELECT COUNT(*) FROM notes WHERE case_id = c.id AND note_category = 'vulnerability') as vulnerability_flags,
                    (SELECT MAX(created_at) FROM notes WHERE case_id = c.id) as last_activity,
                    (SELECT COUNT(*) FROM appointments WHERE case_id = c.id AND status = 'no_show') as no_shows
                FROM cases c
                JOIN clients cl ON c.client_id = cl.id
                WHERE c.centre_id = $1 AND c.status = 'active'
                ORDER BY c.created_at DESC
            `, [centreId]);

            // Compliance risk indicators
            const complianceRisks = await client.query(`
                SELECT 
                    COUNT(CASE WHEN advice_notes = 0 THEN 1 END) as cases_no_advice,
                    COUNT(CASE WHEN ie_documents = 0 THEN 1 END) as cases_no_ie,
                    COUNT(CASE WHEN coa_documents = 0 AND total_notes > 3 THEN 1 END) as cases_no_coa,
                    COUNT(CASE WHEN long_running = true THEN 1 END) as long_running_cases,
                    COUNT(*) as total_active_cases
                FROM (
                    SELECT 
                        c.id,
                        (SELECT COUNT(*) FROM notes WHERE case_id = c.id AND note_category = 'advice_given') as advice_notes,
                        (SELECT COUNT(*) FROM files WHERE case_id = c.id AND document_category = 'financial' AND original_filename ILIKE '%income%expenditure%') as ie_documents,
                        (SELECT COUNT(*) FROM files WHERE case_id = c.id AND document_category = 'generated' AND original_filename ILIKE '%confirmation%') as coa_documents,
                        (SELECT COUNT(*) FROM notes WHERE case_id = c.id) as total_notes,
                        CASE WHEN c.created_at < CURRENT_DATE - INTERVAL '90 days' THEN true ELSE false END as long_running
                    FROM cases c
                    WHERE c.centre_id = $1 AND c.status = 'active'
                ) case_compliance
            `, [centreId]);

            client.release();

            const debtStats = debtAnalysis.rows[0];
            const complianceStats = complianceRisks.rows[0];

            // Calculate case priority scores
            const scoredCases = casePriorities.rows.map(caseItem => {
                let riskScore = 0;
                const daysSinceCreation = (new Date() - new Date(caseItem.created_at)) / (1000 * 60 * 60 * 24);
                const daysSinceActivity = caseItem.last_activity ? 
                    (new Date() - new Date(caseItem.last_activity)) / (1000 * 60 * 60 * 24) : 999;

                // Scoring factors
                if (caseItem.priority_creditors > 0) riskScore += 30;
                if (caseItem.enforcement_actions > 0) riskScore += 40;
                if (caseItem.vulnerability_flags > 0) riskScore += 25;
                if (daysSinceActivity > 30) riskScore += 20;
                if (caseItem.total_debt > 50000) riskScore += 15;
                if (caseItem.no_shows > 1) riskScore += 15;
                if (daysSinceCreation > 90) riskScore += 10;

                return {
                    ...caseItem,
                    risk_score: riskScore,
                    risk_level: riskScore >= 80 ? 'Critical' : 
                               riskScore >= 60 ? 'High' : 
                               riskScore >= 40 ? 'Medium' : 'Low',
                    days_since_creation: Math.round(daysSinceCreation),
                    days_since_activity: Math.round(daysSinceActivity)
                };
            }).sort((a, b) => b.risk_score - a.risk_score);

            return {
                centre_id: centreId,
                debt_analysis: {
                    priority_debts: parseInt(debtStats.priority_debts),
                    non_priority_debts: parseInt(debtStats.non_priority_debts),
                    priority_debt_total: parseFloat(debtStats.priority_debt_total || 0),
                    non_priority_debt_total: parseFloat(debtStats.non_priority_debt_total || 0),
                    priority_ratio: (debtStats.priority_debts + debtStats.non_priority_debts) > 0 ?
                        Math.round((debtStats.priority_debts / (debtStats.priority_debts + debtStats.non_priority_debts)) * 100) : 0
                },
                risk_indicators: {
                    high_debt_cases: parseInt(debtStats.high_debt_cases),
                    stale_cases: parseInt(debtStats.stale_cases),
                    cases_with_vulnerability: parseInt(debtStats.cases_with_vulnerability),
                    cases_with_enforcement: parseInt(debtStats.cases_with_enforcement)
                },
                compliance_risks: {
                    cases_no_advice: parseInt(complianceStats.cases_no_advice),
                    cases_no_ie: parseInt(complianceStats.cases_no_ie),
                    cases_no_coa: parseInt(complianceStats.cases_no_coa),
                    long_running_cases: parseInt(complianceStats.long_running_cases),
                    compliance_rate: Math.round(((complianceStats.total_active_cases - complianceStats.cases_no_advice) / complianceStats.total_active_cases) * 100)
                },
                high_priority_cases: scoredCases.filter(c => c.risk_level === 'Critical' || c.risk_level === 'High').slice(0, 10),
                risk_summary: {
                    total_cases_assessed: scoredCases.length,
                    critical_risk: scoredCases.filter(c => c.risk_level === 'Critical').length,
                    high_risk: scoredCases.filter(c => c.risk_level === 'High').length,
                    medium_risk: scoredCases.filter(c => c.risk_level === 'Medium').length,
                    low_risk: scoredCases.filter(c => c.risk_level === 'Low').length
                },
                generated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting centre risk assessment:', error);
            throw error;
        }
    }

    /**
     * Generate operational insights and recommendations
     */
    async generateOperationalInsights(centreId) {
        try {
            const dashboardMetrics = await this.getCentreDashboardMetrics(centreId, 'month');
            const calendarAnalytics = await this.getCalendarAnalytics(centreId, 'month');
            const riskAssessment = await this.getCentreRiskAssessment(centreId);

            const insights = {
                centre_id: centreId,
                performance_insights: [],
                capacity_insights: [],
                risk_insights: [],
                efficiency_insights: [],
                recommendations: []
            };

            // Performance insights
            if (dashboardMetrics.overview.case_closure_rate < 70) {
                insights.performance_insights.push({
                    type: 'low_closure_rate',
                    severity: 'high',
                    message: `Case closure rate is ${dashboardMetrics.overview.case_closure_rate}%, below optimal 70%`,
                    metric_value: dashboardMetrics.overview.case_closure_rate,
                    benchmark: 70
                });
            }

            if (dashboardMetrics.overview.avg_resolution_days > 45) {
                insights.performance_insights.push({
                    type: 'slow_resolution',
                    severity: 'medium',
                    message: `Average case resolution time is ${dashboardMetrics.overview.avg_resolution_days} days`,
                    metric_value: dashboardMetrics.overview.avg_resolution_days,
                    benchmark: 45
                });
            }

            // Capacity insights
            const overloadedAdvisors = dashboardMetrics.staff.workload_distribution.filter(s => s.workload_score > 80);
            if (overloadedAdvisors.length > 0) {
                insights.capacity_insights.push({
                    type: 'advisor_overload',
                    severity: 'high',
                    message: `${overloadedAdvisors.length} advisors are overloaded`,
                    affected_staff: overloadedAdvisors.map(s => `${s.first_name} ${s.last_name}`)
                });
            }

            if (calendarAnalytics.summary.no_show_rate > 15) {
                insights.capacity_insights.push({
                    type: 'high_no_show_rate',
                    severity: 'medium',
                    message: `No-show rate is ${calendarAnalytics.summary.no_show_rate}%, affecting capacity utilization`,
                    metric_value: calendarAnalytics.summary.no_show_rate,
                    benchmark: 15
                });
            }

            // Risk insights
            if (riskAssessment.risk_summary.critical_risk > 0) {
                insights.risk_insights.push({
                    type: 'critical_risk_cases',
                    severity: 'critical',
                    message: `${riskAssessment.risk_summary.critical_risk} cases require immediate attention`,
                    case_count: riskAssessment.risk_summary.critical_risk
                });
            }

            if (riskAssessment.compliance_risks.compliance_rate < 85) {
                insights.risk_insights.push({
                    type: 'compliance_risk',
                    severity: 'high',
                    message: `Compliance rate is ${riskAssessment.compliance_risks.compliance_rate}%, below target 85%`,
                    metric_value: riskAssessment.compliance_risks.compliance_rate,
                    benchmark: 85
                });
            }

            // Generate recommendations based on insights
            insights.recommendations = this.generateRecommendations(insights, dashboardMetrics, calendarAnalytics, riskAssessment);

            insights.generated_at = new Date().toISOString();
            return insights;

        } catch (error) {
            console.error('Error generating operational insights:', error);
            throw error;
        }
    }

    // Helper methods
    calculateDateRanges(timeframe) {
        const now = dayjs();
        let periodStart, periodEnd, trendStart, futureStart;

        switch (timeframe) {
            case 'week':
                periodStart = now.startOf('week').toISOString();
                periodEnd = now.endOf('week').toISOString();
                trendStart = now.subtract(4, 'week').startOf('week').toISOString();
                break;
            case 'month':
                periodStart = now.startOf('month').toISOString();
                periodEnd = now.endOf('month').toISOString();
                trendStart = now.subtract(3, 'month').startOf('month').toISOString();
                break;
            case 'quarter':
                periodStart = now.startOf('quarter').toISOString();
                periodEnd = now.endOf('quarter').toISOString();
                trendStart = now.subtract(1, 'year').startOf('quarter').toISOString();
                break;
            default:
                periodStart = now.startOf('month').toISOString();
                periodEnd = now.endOf('month').toISOString();
                trendStart = now.subtract(3, 'month').startOf('month').toISOString();
        }

        futureStart = now.toISOString();
        
        return { periodStart, periodEnd, trendStart, futureStart };
    }

    calculateWorkloadScore(staff) {
        const activeCases = parseInt(staff.active_cases) || 0;
        const upcomingAppointments = parseInt(staff.upcoming_appointments_count) || 0;
        return Math.round((activeCases * 3) + (upcomingAppointments * 1));
    }

    calculateAvailabilityScore(advisor) {
        const totalAppts = parseInt(advisor.total_appointments) || 0;
        const completedAppts = parseInt(advisor.completed_appointments) || 0;
        const noShows = parseInt(advisor.no_shows) || 0;
        
        if (totalAppts === 0) return 0;
        
        const completionRate = completedAppts / totalAppts;
        const reliabilityRate = (totalAppts - noShows) / totalAppts;
        
        return Math.round((completionRate * 0.7 + reliabilityRate * 0.3) * 100);
    }

    getDayName(dayNumber) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[parseInt(dayNumber)] || 'Unknown';
    }

    generateRecommendations(insights, dashboardMetrics, calendarAnalytics, riskAssessment) {
        const recommendations = [];

        // Performance recommendations
        if (insights.performance_insights.find(i => i.type === 'low_closure_rate')) {
            recommendations.push({
                category: 'performance',
                priority: 'high',
                title: 'Improve Case Closure Rate',
                description: 'Focus on closing older cases and improving follow-up processes',
                actions: [
                    'Review cases open longer than 60 days',
                    'Implement weekly case review meetings',
                    'Provide additional training on case closure procedures'
                ]
            });
        }

        // Capacity recommendations
        if (insights.capacity_insights.find(i => i.type === 'advisor_overload')) {
            recommendations.push({
                category: 'capacity',
                priority: 'high',
                title: 'Redistribute Workload',
                description: 'Balance caseloads across advisors to prevent burnout',
                actions: [
                    'Redistribute cases from overloaded advisors',
                    'Consider hiring additional staff if consistently overloaded',
                    'Implement workload monitoring dashboard'
                ]
            });
        }

        // Risk recommendations
        if (riskAssessment.risk_summary.critical_risk > 0) {
            recommendations.push({
                category: 'risk',
                priority: 'critical',
                title: 'Address High-Risk Cases',
                description: 'Immediate action required for critical risk cases',
                actions: [
                    'Schedule urgent reviews for all critical risk cases',
                    'Implement daily monitoring for high-risk cases',
                    'Consider escalation procedures for complex cases'
                ]
            });
        }

        return recommendations;
    }

    // MCP Tool Definitions for n8n integration
    getToolDefinitions() {
        return [
            {
                name: 'get_centre_dashboard_metrics',
                description: 'Get comprehensive centre performance metrics and statistics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer', description: 'Centre ID to get metrics for' },
                        timeframe: { type: 'string', enum: ['week', 'month', 'quarter'], default: 'month' }
                    },
                    required: ['centre_id']
                }
            },
            {
                name: 'get_calendar_analytics',
                description: 'Get calendar and appointment analytics with utilization insights',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer', description: 'Centre ID to analyze' },
                        timeframe: { type: 'string', enum: ['week', 'month', 'quarter'], default: 'month' }
                    },
                    required: ['centre_id']
                }
            },
            {
                name: 'get_centre_risk_assessment',
                description: 'Comprehensive risk assessment for centre operations and compliance',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer', description: 'Centre ID to assess' }
                    },
                    required: ['centre_id']
                }
            },
            {
                name: 'generate_operational_insights',
                description: 'Generate AI-powered operational insights and recommendations',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer', description: 'Centre ID to generate insights for' }
                    },
                    required: ['centre_id']
                }
            }
        ];
    }
}

module.exports = new CentreStatisticsMCP();
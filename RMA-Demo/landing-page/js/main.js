// RMA Landing Page - Live Stats

const COORDINATOR_URL = 'COORDINATOR_URL';
const REFRESH_INTERVAL = 10000; // 10 seconds

// Fetch and update stats
async function updateStats() {
    try {
        const [statsRes, healthRes] = await Promise.all([
            fetch(`${COORDINATOR_URL}/api/admin/stats`),
            fetch(`${COORDINATOR_URL}/api/admin/health`)
        ]);

        if (!statsRes.ok || !healthRes.ok) {
            throw new Error('Failed to fetch stats');
        }

        const stats = await statsRes.json();
        const health = await healthRes.json();

        // Update hero stats
        document.getElementById('worker-count').textContent = stats.total_workers || 0;
        document.getElementById('gpu-count').textContent = stats.workers_by_tier?.gpu_workers || 0;
        document.getElementById('task-count').textContent = formatNumber(stats.total_tasks_completed || 0);

        // Update system health
        const healthStatus = document.getElementById('health-status');
        healthStatus.className = `status-indicator ${health.overall_status}`;
        healthStatus.querySelector('.status-text').textContent =
            health.overall_status.charAt(0).toUpperCase() + health.overall_status.slice(1);

        // Update worker distribution
        document.getElementById('tier1-count').textContent = stats.workers_by_tier?.gpu_workers || 0;
        document.getElementById('tier2-count').textContent = stats.workers_by_tier?.service_workers || 0;
        document.getElementById('tier3-count').textContent = stats.workers_by_tier?.data_workers || 0;

        // Update load bars
        const gpuLoad = (stats.average_load_by_tier?.gpu_workers || 0) * 100;
        const serviceLoad = (stats.average_load_by_tier?.service_workers || 0) * 100;

        document.getElementById('gpu-load').style.width = `${gpuLoad}%`;
        document.getElementById('gpu-load-text').textContent = `${gpuLoad.toFixed(0)}%`;
        document.getElementById('service-load').style.width = `${serviceLoad}%`;
        document.getElementById('service-load-text').textContent = `${serviceLoad.toFixed(0)}%`;

        // Update load bar colors
        updateLoadBarColor('gpu-load', gpuLoad);
        updateLoadBarColor('service-load', serviceLoad);

    } catch (error) {
        console.error('Failed to update stats:', error);
        // Show error state
        document.getElementById('health-status').className = 'status-indicator error';
        document.getElementById('health-status').querySelector('.status-text').textContent = 'Offline';
    }
}

// Update load bar color based on percentage
function updateLoadBarColor(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (percentage > 80) {
        element.style.background = '#ef4444'; // Red
    } else if (percentage > 50) {
        element.style.background = '#f59e0b'; // Yellow
    } else {
        element.style.background = '#10b981'; // Green
    }
}

// Format large numbers (e.g., 1247 -> 1.2k)
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Copy code to clipboard
function copyCode() {
    const code = document.getElementById('install-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Update stats immediately
    updateStats();

    // Then refresh every 10 seconds
    setInterval(updateStats, REFRESH_INTERVAL);

    // Add animation to stats on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out';
            }
        });
    });

    document.querySelectorAll('.stat-card, .feature-card, .tier-card').forEach(el => {
        observer.observe(el);
    });
});

// Add fade-in animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

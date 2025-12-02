# RMA Admin Dashboard

Real-time monitoring dashboard for the RMA distributed worker pool.

## Features

- Live worker status (healthy, degraded, offline)
- Worker distribution by tier (GPU, Service, Data)
- System-wide statistics and health monitoring
- Individual worker load and task completion tracking
- Auto-refresh every 5 seconds
- Clean, dark-themed UI

## Development

### Install Dependencies

```bash
cd admin-dashboard
npm install
```

### Run Development Server

```bash
# Make sure coordinator is running on localhost:8080
npm run dev
```

Dashboard will be available at: http://localhost:3001

### Build for Production

```bash
npm run build
```

Built files will be in `dist/` directory.

## Deployment

### Option 1: Serve with Coordinator

Update coordinator's `main.py` to serve static files:

```python
from fastapi.staticfiles import StaticFiles

# After other routers
app.mount("/", StaticFiles(directory="../admin-dashboard/dist", html=True), name="dashboard")
```

Then build and deploy together:
```bash
cd admin-dashboard
npm run build

cd ../coordinator-service
fly deploy
```

Dashboard will be at: https://api.rmatool.org.uk/

### Option 2: Deploy Separately (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd admin-dashboard
vercel deploy --prod
```

Update `vite.config.js` to point to production coordinator:
```javascript
proxy: {
  '/api': {
    target: 'https://api.rmatool.org.uk',
    changeOrigin: true
  }
}
```

### Option 3: Deploy to Netlify

```bash
# Build
npm run build

# Deploy to Netlify
# Upload dist/ folder via Netlify UI
# Or use Netlify CLI
```

Add `_redirects` file in `public/`:
```
/api/* https://api.rmatool.org.uk/api/:splat 200
/* /index.html 200
```

## Dashboard Overview

### Main Stats
- **Total Workers**: All registered workers
- **Healthy Workers**: Workers responding to heartbeats
- **GPU Workers**: Tier 1 workers (vLLM, Vision models)
- **Service Workers**: Tier 2 workers (RAG, NER, etc)
- **Data Workers**: Tier 3 workers (databases)
- **Tasks Completed**: Total tasks across all workers

### Load Metrics
- **GPU Average Load**: Average CPU load across Tier 1 workers
- **Service Average Load**: Average CPU load across Tier 2 workers
- **System Health**: Overall system status (healthy/degraded/error)

### Worker Table
- **Worker ID**: Unique identifier
- **Tier**: 1 (GPU), 2 (Service), or 3 (Data)
- **Status**: healthy, degraded, or offline
- **Load**: Current CPU utilization (visual bar + percentage)
- **Containers**: Assigned container names
- **Tasks**: Number of completed tasks
- **Registered**: Registration timestamp

## Status Indicators

### Worker Status
- **Healthy** (green): Heartbeat received within last 2 minutes
- **Degraded** (yellow): Experiencing issues
- **Offline** (red): No heartbeat for 2+ minutes

### Load Colors
- **Green**: < 50% load (healthy)
- **Yellow**: 50-80% load (moderate)
- **Red**: > 80% load (high)

### System Health
- **Healthy**: Has GPU workers and service workers, majority healthy
- **Degraded**: Missing GPU or service workers, or majority offline
- **Error**: Critical system issues

## API Endpoints Used

- `GET /api/admin/stats` - System statistics
- `GET /api/admin/workers` - Worker list
- `GET /api/admin/health` - System health

## Customization

### Update Refresh Interval

In `src/App.jsx`:
```javascript
const interval = setInterval(fetchData, 5000) // Change 5000 to desired ms
```

### Change Theme Colors

Edit `src/index.css`:
```css
body {
  background: #0f172a; /* Dark blue background */
  color: #e2e8f0;      /* Light text */
}
```

### Add Charts

Install recharts (already included):
```bash
npm install recharts
```

Example line chart for worker count over time:
```javascript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

// In component
<LineChart width={600} height={300} data={historicalData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="time" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="workers" stroke="#60a5fa" />
</LineChart>
```

## Troubleshooting

### Dashboard shows "Error loading"

1. Check coordinator is running:
   ```bash
   curl http://localhost:8080/health
   ```

2. Check proxy configuration in `vite.config.js`

3. Check CORS settings in coordinator

### Workers not showing

1. Verify workers are registered:
   ```bash
   curl http://localhost:8080/api/admin/workers
   ```

2. Check coordinator logs for errors

### Stale data

1. Check auto-refresh is working (watch "Last updated" time)
2. Check browser console for fetch errors
3. Verify network connectivity

## Production Checklist

- [ ] Update API proxy to production coordinator URL
- [ ] Build optimized production bundle (`npm run build`)
- [ ] Enable HTTPS for coordinator
- [ ] Configure CORS for dashboard domain
- [ ] Set up monitoring/analytics (optional)
- [ ] Add authentication if dashboard is public-facing

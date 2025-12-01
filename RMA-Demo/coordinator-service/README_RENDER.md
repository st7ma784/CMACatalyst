# RMA Coordinator - Render.com Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/st7ma784/CMACatalyst)

## Configuration

This service is pre-configured for Render.com deployment with:

- **Service Type**: Web Service
- **Plan**: Free (750 hours/month)
- **Runtime**: Python 3.11
- **Build**: Automatic dependency installation
- **Start**: FastAPI via Uvicorn
- **Health Check**: `/health` endpoint
- **Auto-Deploy**: Enabled on git push

## Environment Variables

The following environment variables are automatically configured:

- `JWT_SECRET`: Auto-generated secure random string
- `PYTHON_VERSION`: 3.11
- `PORT`: Auto-configured by Render

## Post-Deployment

Once deployed, your coordinator will be available at:
```
https://rma-coordinator.onrender.com
```

Update your workers to use this URL:
```bash
cd worker-containers
echo 'COORDINATOR_URL=https://rma-coordinator.onrender.com' > .env.coordinator
cd cpu-worker && docker-compose restart
```

## Free Tier Limitations

- **Sleep after 15 minutes** of inactivity
- **512MB RAM** limit
- **750 hours/month** runtime

Set up a free uptime monitor to prevent sleep:
- UptimeRobot: https://uptimerobot.com
- Interval: 5 minutes
- URL: https://rma-coordinator.onrender.com/health

## Support

See detailed deployment guide: `DEPLOY_RENDER_NOW.md`

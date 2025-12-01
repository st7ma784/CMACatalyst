# RMA Distributed - Public Landing Page

Public-facing landing page for the RMA distributed compute pool.

## Features

- Live system statistics (auto-refreshing)
- Worker tier explanation
- Quick start guide with code examples
- System architecture visualization
- Responsive design
- Copy-to-clipboard for commands
- Animated elements on scroll

## Deployment

### Option 1: Vercel (Recommended - Free)

```bash
cd landing-page
vercel deploy --prod
```

### Option 2: GitHub Pages (Free)

```bash
# In your GitHub repo settings:
# 1. Go to Settings → Pages
# 2. Source: Deploy from branch
# 3. Branch: main or gh-pages
# 4. Folder: /landing-page

# Then push:
git add landing-page
git commit -m "Add landing page"
git push
```

### Option 3: Netlify (Free)

1. Connect GitHub repo to Netlify
2. Set build directory to `landing-page`
3. Deploy!

## Configuration

Before deploying, update the URLs in `index.html`:

```html
<!-- Replace these placeholders -->
COORDINATOR_URL  → https://rma-coordinator.fly.dev
FRONTEND_URL     → https://rma-demo.vercel.app
ADMIN_URL        → https://rma-admin.vercel.app
```

Or use the deployment script:
```bash
cd RMA-Demo
./deploy-free-tier.sh
```

The script automatically replaces URLs.

## Live Stats

The landing page fetches live stats from coordinator:
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/health` - System health

Stats refresh every 10 seconds automatically.

## Customization

### Update Branding

Edit `index.html`:
```html
<div class="logo-text">Your Project Name</div>
<title>Your Project - Landing Page</title>
```

### Change Colors

Edit `css/style.css`:
```css
:root {
    --primary: #3b82f6;     /* Change primary color */
    --secondary: #8b5cf6;   /* Change secondary color */
}
```

### Add Analytics

Add before `</head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

## Structure

```
landing-page/
├── index.html           # Main HTML
├── css/
│   └── style.css       # Styles
├── js/
│   └── main.js         # Live stats & interactions
├── images/             # Images (optional)
└── README.md           # This file
```

## Sections

1. **Hero**: Main headline with live stats
2. **How It Works**: 3-step explanation
3. **Worker Tiers**: Tier requirements and features
4. **Quick Start**: Installation commands
5. **Architecture**: System diagram
6. **Live Stats**: Real-time worker distribution
7. **Footer**: Links and info

## Local Development

```bash
# Simple HTTP server
cd landing-page
python -m http.server 8080

# Or with Node
npx http-server -p 8080
```

Visit: http://localhost:8080

## Testing

Before deploying, test:

1. **Links work**:
   - All navigation links
   - Dashboard/Admin URLs
   - External links (GitHub, etc.)

2. **Stats update**:
   - Check browser console for errors
   - Verify stats refresh every 10s
   - Test with coordinator offline

3. **Responsive**:
   - Test on mobile (< 768px)
   - Test on tablet (768px - 1024px)
   - Test on desktop (> 1024px)

4. **Copy button**:
   - Click "Copy" on code blocks
   - Verify copied to clipboard

## CORS Configuration

Make sure coordinator allows your landing page domain:

```python
# In coordinator-service/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "https://rma-landing.vercel.app",  # Add your domain
        "https://yourdomain.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## SEO Optimization

Add meta tags to `<head>`:

```html
<meta name="description" content="Join the RMA distributed compute pool. Donate idle GPU/CPU time and access free AI inference.">
<meta property="og:title" content="RMA Distributed Compute Pool">
<meta property="og:description" content="Democratized AI infrastructure for everyone">
<meta property="og:image" content="/images/og-image.png">
<meta property="og:url" content="https://yourdomain.com">
<meta name="twitter:card" content="summary_large_image">
```

## Performance

**Current size**:
- HTML: ~15KB
- CSS: ~10KB
- JS: ~3KB
- **Total**: ~28KB (tiny!)

**Load time**: < 500ms on free tier

**Lighthouse score**: Should get 90+ on all metrics

## Troubleshooting

### Stats not loading

1. Check coordinator is accessible:
   ```bash
   curl https://rma-coordinator.fly.dev/api/admin/stats
   ```

2. Check CORS configuration in coordinator

3. Check browser console for errors

### Copy button not working

Some browsers block clipboard access on non-HTTPS sites. Deploy to HTTPS or test locally with secure flag.

### Animations janky

Check browser performance. Reduce animation complexity in `style.css` if needed.

## License

Same as main RMA project (typically MIT or Apache 2.0)

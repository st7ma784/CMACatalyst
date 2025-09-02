# GitHub Pages Deployment Guide

This guide explains how to deploy the Sphinx documentation to GitHub Pages for the CMA Case Management System.

## Prerequisites

1. **GitHub Repository**: Ensure your project is hosted on GitHub
2. **GitHub Pages**: Enable GitHub Pages in repository settings
3. **Sphinx**: Documentation built with Sphinx (already configured)

## Setup GitHub Actions Workflow

Create the following GitHub Actions workflow to automatically build and deploy documentation:

### `.github/workflows/docs.yml`
```yaml
name: Build and Deploy Documentation

on:
  push:
    branches: [ main ]
    paths: 
      - 'docs/**'
      - '.github/workflows/docs.yml'
  pull_request:
    branches: [ main ]
    paths: 
      - 'docs/**'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install sphinx myst-parser sphinx-rtd-theme sphinx-copybutton
        
    - name: Build documentation
      run: |
        cd docs
        make html
        
    - name: Setup Pages
      if: github.ref == 'refs/heads/main'
      uses: actions/configure-pages@v3
      
    - name: Upload artifact
      if: github.ref == 'refs/heads/main'
      uses: actions/upload-pages-artifact@v2
      with:
        path: docs/_build/html

  deploy:
    if: github.ref == 'refs/heads/main'
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

## Repository Configuration

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **GitHub Actions**
5. Save the settings

### 2. Configure Repository Secrets (if needed)

For private repositories or additional features, you may need to set up secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add any required secrets (typically not needed for public documentation)

## Local Development and Testing

### Build Documentation Locally
```bash
# Navigate to docs directory
cd docs

# Install dependencies
pip install -r requirements.txt

# Build HTML documentation
make html

# Serve locally for testing
python -m http.server 8000 --directory _build/html
```

### Preview Changes
Open your browser and navigate to `http://localhost:8000` to preview the documentation.

## Documentation Structure

```
docs/
├── conf.py                 # Sphinx configuration
├── index.md               # Main documentation index
├── introduction.md        # Platform introduction
├── requirements.txt       # Python dependencies
├── Makefile              # Build commands
├── architecture/         # Technical architecture docs
│   ├── overview.md
│   └── database.md
├── features/             # Feature documentation
│   └── ai-features.md
├── deployment/           # Deployment guides
│   └── aws-guide.md
├── api/                  # API documentation
│   └── reference.md
└── _build/               # Generated HTML (ignored in git)
    └── html/
```

## Customizing the Documentation Theme

### Custom CSS
Create `docs/_static/custom.css`:

```css
/* Custom styling for CMA documentation */
.wy-nav-content {
    max-width: 1200px;
}

.rst-content h1 {
    color: #2c3e50;
    border-bottom: 3px solid #3498db;
    padding-bottom: 10px;
}

.rst-content h2 {
    color: #34495e;
    border-bottom: 2px solid #ecf0f1;
}

/* Custom code block styling */
.highlight {
    background: #f8f9fa;
    border-left: 4px solid #3498db;
    padding: 10px;
    margin: 15px 0;
}

/* Custom note/warning boxes */
.admonition.note {
    background-color: #e8f4fd;
    border-left: 4px solid #3498db;
}

.admonition.warning {
    background-color: #fff3cd;
    border-left: 4px solid #ffc107;
}

/* Navigation improvements */
.wy-menu-vertical a:hover {
    background-color: #3498db;
    color: white;
}
```

Update `conf.py` to include custom CSS:
```python
html_static_path = ['_static']
html_css_files = ['custom.css']
```

### Logo and Favicon
Add your organization's logo:

1. Place logo files in `docs/_static/`
2. Update `conf.py`:

```python
html_logo = '_static/logo.png'
html_favicon = '_static/favicon.ico'
```

## Advanced GitHub Pages Features

### Custom Domain Setup

1. **Add CNAME file**: Create `docs/_static/CNAME` with your domain:
   ```
   docs.cma-platform.com
   ```

2. **Update conf.py** to copy CNAME file:
   ```python
   html_extra_path = ['_static/CNAME']
   ```

3. **Configure DNS**: Point your domain to GitHub Pages:
   ```
   CNAME record: docs.cma-platform.com → username.github.io
   ```

### Analytics Integration

Add Google Analytics to `conf.py`:
```python
html_theme_options = {
    'analytics_id': 'G-XXXXXXXXXX',  # Your GA tracking ID
    'analytics_anonymize_ip': True,
}
```

## Automation and Maintenance

### Auto-update Documentation

Create a script to automatically update API documentation:

```bash
#!/bin/bash
# scripts/update-docs.sh

echo "Updating API documentation..."

# Generate API docs from OpenAPI spec
swagger-codegen generate \
  -i http://localhost:5000/api/swagger.json \
  -l html2 \
  -o docs/api/generated/

# Update database schema docs
pg_dump --schema-only $DATABASE_URL > docs/architecture/schema.sql

# Rebuild documentation
cd docs && make html

echo "Documentation updated successfully!"
```

### Version Management

For versioned documentation, update the workflow:

```yaml
- name: Build versioned docs
  run: |
    cd docs
    # Build current version
    make html
    
    # Build for specific version tag if tagged
    if [[ $GITHUB_REF == refs/tags/* ]]; then
      VERSION=${GITHUB_REF#refs/tags/}
      mkdir -p _build/html/$VERSION
      cp -r _build/html/* _build/html/$VERSION/
    fi
```

### Documentation Quality Checks

Add documentation quality checks to your workflow:

```yaml
- name: Check documentation quality
  run: |
    # Check for broken links
    sphinx-build -b linkcheck docs docs/_build/linkcheck
    
    # Check for spelling errors
    sphinx-build -b spelling docs docs/_build/spelling
    
    # Validate markup
    sphinx-build -W -b html docs docs/_build/html
```

## Monitoring and Analytics

### Documentation Analytics

Track documentation usage with:

1. **Google Analytics**: Page views, user engagement
2. **GitHub Insights**: Repository traffic, popular pages
3. **Custom tracking**: User feedback, search queries

### Performance Optimization

Optimize documentation loading:

```python
# conf.py optimizations
html_theme_options = {
    'navigation_depth': 3,
    'collapse_navigation': True,
    'sticky_navigation': True,
    'includehidden': False,
}

# Enable search optimization
html_search_language = 'en'
html_search_options = {
    'type': 'default',
    'teaser_length': 200
}
```

## SEO and Discoverability

### SEO Configuration

```python
# conf.py SEO settings
html_meta = {
    'description': 'Comprehensive documentation for CMA Case Management System',
    'keywords': 'debt advice, case management, documentation, API',
    'author': 'CMA Development Team',
    'viewport': 'width=device-width, initial-scale=1.0'
}
```

### Sitemap Generation

Add sitemap generation:

```python
extensions = [
    # ... existing extensions
    'sphinx_sitemap',
]

html_baseurl = 'https://your-username.github.io/your-repo/'
sitemap_url_scheme = "{link}"
```

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check Python dependencies in `requirements.txt`
   - Verify Sphinx configuration syntax
   - Review workflow YAML formatting

2. **Styling Issues**:
   - Clear browser cache
   - Check CSS file paths
   - Verify static file configuration

3. **Navigation Problems**:
   - Review `toctree` structure
   - Check file organization
   - Validate markdown syntax

### Debug Build Locally

```bash
# Verbose build for debugging
sphinx-build -v -W docs docs/_build/html

# Check for warnings
sphinx-build -b html -W --keep-going docs docs/_build/html
```

Your documentation will be automatically deployed to `https://your-username.github.io/your-repository/` when changes are pushed to the main branch.

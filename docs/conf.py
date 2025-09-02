# Configuration file for the Sphinx documentation builder.

# -- Project information -----------------------------------------------------
project = 'CMA Case Management System'
copyright = '2025, CMA Catalyst Team'
author = 'CMA Catalyst Team'
release = '2.0.0'

# -- General configuration ---------------------------------------------------
extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.viewcode',
    'sphinx.ext.napoleon',
    'sphinx.ext.intersphinx',
    'sphinx.ext.githubpages',
    'myst_parser',
    'sphinx_rtd_theme',
    'sphinx.ext.graphviz',
    'sphinx.ext.todo'
]

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# -- Options for HTML output -------------------------------------------------
html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']
html_logo = '_static/logo.png'
html_favicon = '_static/favicon.ico'

html_theme_options = {
    'logo_only': False,
    'display_version': True,
    'prev_next_buttons_location': 'bottom',
    'style_external_links': False,
    'collapse_navigation': True,
    'sticky_navigation': True,
    'navigation_depth': 4,
    'includehidden': True,
    'titles_only': False
}

# -- Extension configuration -------------------------------------------------
napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_include_init_with_doc = False
napoleon_include_private_with_doc = False

intersphinx_mapping = {
    'python': ('https://docs.python.org/3/', None),
    'react': ('https://react.dev/', None),
}

# -- MyST configuration ------------------------------------------------------
myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "html_admonition",
    "html_image",
    "linkify",
    "replacements",
    "smartquotes",
    "substitution",
    "tasklist",
]

# -- Todo configuration ------------------------------------------------------
todo_include_todos = True

# -- Custom CSS --------------------------------------------------------------
html_css_files = [
    'custom.css',
]

# -- GitHub Pages configuration ----------------------------------------------
html_baseurl = 'https://st7ma784.github.io/CMACatalyst/'

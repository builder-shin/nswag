/**
 * ui subcommand
 * UI-related commands (ui:custom, ui:copy-assets)
 */

import { existsSync, mkdirSync, writeFileSync, cpSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { logger, Spinner, type ParsedArgs } from '../utils.js';

/**
 * UI engine type
 */
type UIEngine = 'swagger-ui' | 'redoc';

/**
 * Execute ui:custom subcommand
 * Create custom UI template
 */
export async function runUiCustom(args: ParsedArgs): Promise<void> {
  logger.title('Create Custom UI Template');

  const outputPath = args.args[0] || './views/nswag/ui';
  const fullPath = resolve(process.cwd(), outputPath);
  const force = args.flags.force === true || args.flags.f === true;
  const engine = (args.flags.engine as UIEngine) || 'swagger-ui';

  // Create directory
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
    logger.success(`Directory created: ${outputPath}`);
  }

  // Create custom template files by engine
  const templates: Record<string, string> = engine === 'redoc'
    ? {
        'index.html': getRedocIndexHtmlTemplate(),
        'custom.css': getRedocCustomCssTemplate(),
        'config.json': getRedocConfigJsonTemplate(),
      }
    : {
        'index.html': getSwaggerUiIndexHtmlTemplate(),
        'custom.css': getSwaggerUiCustomCssTemplate(),
        'custom.js': getSwaggerUiCustomJsTemplate(),
        'config.json': getSwaggerUiConfigJsonTemplate(),
      };

  for (const [filename, content] of Object.entries(templates)) {
    const filePath = join(fullPath, filename);

    if (existsSync(filePath) && !force) {
      logger.warn(`${filename} already exists (use --force to overwrite)`);
      continue;
    }

    writeFileSync(filePath, content, 'utf-8');
    logger.success(`${filename} created`);
  }

  logger.newline();
  logger.success(`Custom ${engine} template created!`);
  logger.newline();
  logger.info('Next steps:');
  logger.info(`  1. Set spec file path in ${outputPath}/config.json`);
  logger.info(`  2. Customize styles in ${outputPath}/custom.css`);
  if (engine === 'swagger-ui') {
    logger.info(`  3. Customize behavior in ${outputPath}/custom.js`);
  }
  logger.newline();
  logger.info('Usage example:');
  logger.info(`  swaggerUi({ customHtmlPath: '${outputPath}/index.html' })`);
  logger.newline();
}

/**
 * Execute ui:copy-assets subcommand
 * Copy static files
 */
export async function runUiCopyAssets(args: ParsedArgs): Promise<void> {
  logger.title('Copy UI Static Files');

  const outputPath = args.args[0];
  const engine = (args.flags.engine as UIEngine) || 'swagger-ui';

  if (!outputPath) {
    logger.error('Output path is required');
    logger.info('Usage: npx nswag ui:copy-assets ./public/api-docs');
    logger.info('Options:');
    logger.info('  --engine swagger-ui|redoc  Select UI engine (default: swagger-ui)');
    process.exit(1);
  }

  const fullPath = resolve(process.cwd(), outputPath);
  const spinner = new Spinner(`Copying ${engine} static files...`);
  spinner.start();

  try {
    // Create output directory
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }

    if (engine === 'redoc') {
      // Create Redoc static files
      await copyRedocAssets(fullPath);
    } else {
      // Create Swagger UI static files
      await copySwaggerUiAssets(fullPath);
    }

    spinner.stop(true);
    logger.newline();
    logger.success(`${engine} static files copied: ${outputPath}`);
    logger.newline();
    logger.info('Created files:');
    logger.info(`  ${outputPath}/index.html`);
    if (engine === 'swagger-ui') {
      logger.info(`  ${outputPath}/swagger-initializer.js`);
    }
    logger.newline();
    logger.info('Serve this directory with a web server.');
    logger.info('Example: npx serve ' + outputPath);
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

/**
 * Copy Swagger UI static files
 */
async function copySwaggerUiAssets(outputPath: string): Promise<void> {
  // Find swagger-ui-dist package path
  try {
    const swaggerUiDistPath = findPackagePath('swagger-ui-dist');
    if (swaggerUiDistPath) {
      // Copy only necessary files
      const filesToCopy = [
        'swagger-ui.css',
        'swagger-ui-bundle.js',
        'swagger-ui-standalone-preset.js',
        'favicon-32x32.png',
        'favicon-16x16.png',
      ];

      for (const file of filesToCopy) {
        const srcPath = join(swaggerUiDistPath, file);
        const destPath = join(outputPath, file);
        if (existsSync(srcPath)) {
          cpSync(srcPath, destPath);
        }
      }
    }
  } catch {
    // Use CDN version if swagger-ui-dist is not found
    logger.warn('Could not find swagger-ui-dist, will use CDN version.');
  }

  // Create index.html
  const indexHtml = getSwaggerUiStaticHtml();
  writeFileSync(join(outputPath, 'index.html'), indexHtml, 'utf-8');

  // Create swagger-initializer.js
  const initializerJs = getSwaggerUiInitializerJs();
  writeFileSync(join(outputPath, 'swagger-initializer.js'), initializerJs, 'utf-8');
}

/**
 * Copy Redoc static files
 */
async function copyRedocAssets(outputPath: string): Promise<void> {
  // Create index.html
  const indexHtml = getRedocStaticHtml();
  writeFileSync(join(outputPath, 'index.html'), indexHtml, 'utf-8');
}

/**
 * Find package path
 */
function findPackagePath(packageName: string): string | null {
  try {
    const resolvedPath = require.resolve(`${packageName}/package.json`);
    return dirname(resolvedPath);
  } catch {
    return null;
  }
}

// ========== Swagger UI Templates ==========

/**
 * Swagger UI index.html custom template
 */
function getSwaggerUiIndexHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>

  <!-- Swagger UI -->
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">

  <!-- Custom styles -->
  <link rel="stylesheet" href="./custom.css">
</head>
<body>
  <div id="swagger-ui"></div>

  <!-- Swagger UI scripts -->
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>

  <!-- Load configuration -->
  <script>
    fetch('./config.json')
      .then(response => response.json())
      .then(config => {
        const ui = SwaggerUIBundle({
          url: config.specUrl || './openapi.json',
          urls: config.specUrls || undefined,
          'urls.primaryName': config.primaryName || undefined,
          dom_id: '#swagger-ui',
          deepLinking: config.deepLinking !== false,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
          ],
          layout: config.layout || 'StandaloneLayout',
          ...config.swaggerUiOptions
        });

        window.ui = ui;
      })
      .catch(err => {
        console.error('Failed to load configuration:', err);
        // Run with default configuration
        const ui = SwaggerUIBundle({
          url: './openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: 'StandaloneLayout'
        });
        window.ui = ui;
      });
  </script>

  <!-- Custom script -->
  <script src="./custom.js"></script>
</body>
</html>
`;
}

/**
 * Swagger UI custom.css template
 */
function getSwaggerUiCustomCssTemplate(): string {
  return `/**
 * Custom styles
 * Override Swagger UI styles
 */

/* Header styles */
.swagger-ui .topbar {
  background-color: #1a1a2e;
}

/* Hide logo */
.swagger-ui .topbar-wrapper img {
  content: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>');
}

/* Title styles */
.swagger-ui .info .title {
  color: #333;
  font-weight: 700;
}

/* Operation tag styles */
.swagger-ui .opblock-tag {
  border-bottom: 1px solid #e0e0e0;
}

/* HTTP method colors */
.swagger-ui .opblock.opblock-get .opblock-summary-method {
  background: #61affe;
}

.swagger-ui .opblock.opblock-post .opblock-summary-method {
  background: #49cc90;
}

.swagger-ui .opblock.opblock-put .opblock-summary-method {
  background: #fca130;
}

.swagger-ui .opblock.opblock-delete .opblock-summary-method {
  background: #f93e3e;
}

.swagger-ui .opblock.opblock-patch .opblock-summary-method {
  background: #50e3c2;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .swagger-ui .wrapper {
    padding: 0 10px;
  }
}
`;
}

/**
 * Swagger UI custom.js template
 */
function getSwaggerUiCustomJsTemplate(): string {
  return `/**
 * Custom JavaScript
 * Extend Swagger UI behavior
 */

// Execute when page load is complete
window.addEventListener('load', function() {
  console.log('API documentation loaded');

  // Example: Collapse all operations by default
  // setTimeout(() => {
  //   document.querySelectorAll('.opblock').forEach(block => {
  //     if (block.classList.contains('is-open')) {
  //       block.querySelector('.opblock-summary').click();
  //     }
  //   });
  // }, 1000);
});

// API call interceptor (example)
// window.ui.getConfigs().requestInterceptor = (request) => {
//   // Add authentication headers, etc.
//   return request;
// };

// Custom functions
const apiDocs = {
  // Scroll to specific tag
  scrollToTag: function(tagName) {
    const element = document.querySelector(\`[id="operations-tag-\${tagName}"]\`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  },

  // Expand all operations
  expandAll: function() {
    document.querySelectorAll('.opblock:not(.is-open) .opblock-summary').forEach(summary => {
      summary.click();
    });
  },

  // Collapse all operations
  collapseAll: function() {
    document.querySelectorAll('.opblock.is-open .opblock-summary').forEach(summary => {
      summary.click();
    });
  },

  // Filter operations
  filterOperations: function(query) {
    const lowerQuery = query.toLowerCase();
    document.querySelectorAll('.opblock').forEach(block => {
      const text = block.textContent.toLowerCase();
      block.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
  }
};

// Expose globally
window.apiDocs = apiDocs;
`;
}

/**
 * Swagger UI config.json template
 */
function getSwaggerUiConfigJsonTemplate(): string {
  return `{
  "specUrl": "./openapi.json",
  "specUrls": null,
  "primaryName": null,
  "deepLinking": true,
  "layout": "StandaloneLayout",
  "swaggerUiOptions": {
    "displayRequestDuration": true,
    "filter": true,
    "showExtensions": true,
    "showCommonExtensions": true,
    "tryItOutEnabled": true,
    "persistAuthorization": true,
    "defaultModelsExpandDepth": 1,
    "defaultModelExpandDepth": 3,
    "docExpansion": "list"
  }
}
`;
}

/**
 * Swagger UI static HTML
 */
function getSwaggerUiStaticHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script src="./swagger-initializer.js"></script>
</body>
</html>
`;
}

/**
 * Swagger UI initialization script
 */
function getSwaggerUiInitializerJs(): string {
  return `window.onload = function() {
  // Customize configuration here
  const ui = SwaggerUIBundle({
    url: "./openapi.json",
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout",
    // Additional settings
    displayRequestDuration: true,
    filter: true,
    persistAuthorization: true
  });

  window.ui = ui;
};
`;
}

// ========== Redoc Templates ==========

/**
 * Redoc index.html custom template
 */
function getRedocIndexHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">

  <!-- Custom styles -->
  <link rel="stylesheet" href="./custom.css">

  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="redoc-container"></div>

  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>

  <!-- Load configuration -->
  <script>
    fetch('./config.json')
      .then(response => response.json())
      .then(config => {
        Redoc.init(
          config.specUrl || './openapi.json',
          config.redocOptions || {},
          document.getElementById('redoc-container')
        );
      })
      .catch(err => {
        console.error('Failed to load configuration:', err);
        // Run with default configuration
        Redoc.init('./openapi.json', {}, document.getElementById('redoc-container'));
      });
  </script>
</body>
</html>
`;
}

/**
 * Redoc custom.css template
 */
function getRedocCustomCssTemplate(): string {
  return `/**
 * Custom styles
 * Override Redoc styles
 */

/* Sidebar styles */
.menu-content {
  /* background-color: #fafafa; */
}

/* API info header */
.api-info h1 {
  /* color: #333; */
}

/* HTTP method badge colors */
.http-verb.get {
  /* background-color: #61affe; */
}

.http-verb.post {
  /* background-color: #49cc90; */
}

.http-verb.put {
  /* background-color: #fca130; */
}

.http-verb.delete {
  /* background-color: #f93e3e; */
}

.http-verb.patch {
  /* background-color: #50e3c2; */
}

/* Code block styles */
pre code {
  /* font-size: 13px; */
}

/* Responsive adjustments */
@media (max-width: 768px) {
  /* Mobile styles */
}
`;
}

/**
 * Redoc config.json template
 */
function getRedocConfigJsonTemplate(): string {
  return `{
  "specUrl": "./openapi.json",
  "redocOptions": {
    "theme": {
      "colors": {
        "primary": {
          "main": "#32329f"
        }
      },
      "typography": {
        "fontSize": "14px",
        "fontFamily": "'Roboto', sans-serif"
      },
      "sidebar": {
        "backgroundColor": "#fafafa"
      }
    },
    "expandResponses": "200,201",
    "hideDownloadButton": false,
    "nativeScrollbars": true,
    "pathInMiddlePanel": false,
    "requiredPropsFirst": true,
    "sortPropsAlphabetically": false,
    "showExtensions": true
  }
}
`;
}

/**
 * Redoc static HTML
 */
function getRedocStaticHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <!-- Modify specUrl here -->
  <redoc spec-url="./openapi.json"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
`;
}

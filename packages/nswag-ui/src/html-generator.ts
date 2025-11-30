/**
 * HTML generator
 * Generate Swagger UI and Redoc HTML pages
 */

import { readFileSync, existsSync } from 'fs';
import {
  DEFAULT_SWAGGER_UI_OPTIONS,
  DEFAULT_REDOC_OPTIONS,
  type SwaggerUiOptions,
  type RedocOptions,
  type SpecUrl,
} from './types.js';

/**
 * Generate Swagger UI HTML page
 *
 * @param options - Swagger UI options
 * @returns HTML string
 */
export function generateSwaggerUIHtml(options: SwaggerUiOptions): string {
  // Use custom HTML template
  if (options.customHtmlPath && existsSync(options.customHtmlPath)) {
    return readFileSync(options.customHtmlPath, 'utf-8');
  }

  const title = options.customSiteTitle ?? DEFAULT_SWAGGER_UI_OPTIONS.customSiteTitle;
  const favicon = options.customFavicon ?? '/favicon.ico';

  // Build spec URL configuration
  const specConfig = buildSpecConfig(options);

  // Build Swagger UI configuration object
  const configObject = {
    dom_id: '#swagger-ui',
    presets: ['SwaggerUIBundle.presets.apis', 'SwaggerUIStandalonePreset'],
    plugins: ['SwaggerUIBundle.plugins.DownloadUrl'],
    layout: 'StandaloneLayout',
    ...DEFAULT_SWAGGER_UI_OPTIONS.configObject,
    ...options.configObject,
    ...specConfig,
  };

  // Convert configuration object to JavaScript code (presets/plugins are references, not strings)
  const configJs = buildConfigJs(configObject);

  // Build CSS styles
  const cssStyles = buildCssStyles(options);

  // Build JavaScript
  const jsScripts = buildJsScripts(options);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/x-icon" href="${escapeHtml(favicon)}">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
${cssStyles}
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle(${configJs});
      window.ui = ui;
    };
  </script>
${jsScripts}
</body>
</html>`;
}

/**
 * Generate Redoc HTML page
 *
 * @param options - Redoc options
 * @returns HTML string
 */
export function generateRedocHtml(options: RedocOptions): string {
  const title = options.customSiteTitle ?? DEFAULT_REDOC_OPTIONS.customSiteTitle;
  const favicon = options.customFavicon ?? '/favicon.ico';

  // Build Redoc options
  const redocOptions = {
    ...DEFAULT_REDOC_OPTIONS.options,
    ...options.options,
  };

  // Options attribute string
  const optionsAttr = Object.keys(redocOptions).length > 0
    ? ` options='${JSON.stringify(redocOptions)}'`
    : '';

  // Build CSS styles
  const cssStyles = buildCssStyles(options);

  // Build JavaScript
  const jsScripts = buildJsScripts(options);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/x-icon" href="${escapeHtml(favicon)}">
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
${cssStyles}
</head>
<body>
  <redoc spec-url="${escapeHtml(options.specUrl)}"${optionsAttr}></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
${jsScripts}
</body>
</html>`;
}

/**
 * Build spec URL configuration
 */
function buildSpecConfig(options: SwaggerUiOptions): Record<string, unknown> {
  // Multiple spec URLs
  if (options.specUrls && options.specUrls.length > 0) {
    const config: Record<string, unknown> = {
      urls: options.specUrls.map((spec: SpecUrl) => ({
        url: spec.url,
        name: spec.name,
      })),
    };

    // Set default selected spec
    if (options.primaryName) {
      const primaryIndex = options.specUrls.findIndex(
        (spec: SpecUrl) => spec.name === options.primaryName
      );
      if (primaryIndex >= 0) {
        config['urls.primaryName'] = options.primaryName;
      }
    }

    return config;
  }

  // Single spec URL
  if (options.specUrl) {
    return { url: options.specUrl };
  }

  return {};
}

/**
 * Convert configuration object to JavaScript code
 */
function buildConfigJs(config: Record<string, unknown>): string {
  const entries: string[] = [];

  for (const [key, value] of Object.entries(config)) {
    if (key === 'presets' || key === 'plugins') {
      // Convert presets and plugins to actual references, not string arrays
      const refs = (value as string[]).map((ref) => ref);
      entries.push(`${key}: [${refs.join(', ')}]`);
    } else if (key === 'layout') {
      entries.push(`${key}: "${value}"`);
    } else if (typeof value === 'string') {
      entries.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === 'object' && value !== null) {
      entries.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      entries.push(`${key}: ${value}`);
    }
  }

  return `{\n        ${entries.join(',\n        ')}\n      }`;
}

/**
 * Build CSS styles
 */
function buildCssStyles(options: SwaggerUiOptions | RedocOptions): string {
  const styles: string[] = [];

  // External CSS URL
  if (options.customCssUrl) {
    styles.push(`  <link rel="stylesheet" type="text/css" href="${escapeHtml(options.customCssUrl)}">`);
  }

  // Inline CSS
  if (options.customCss) {
    styles.push(`  <style>${options.customCss}</style>`);
  }

  return styles.join('\n');
}

/**
 * Build JavaScript
 */
function buildJsScripts(options: SwaggerUiOptions | RedocOptions): string {
  if (options.customJs) {
    return `  <script>${options.customJs}</script>`;
  }
  return '';
}

/**
 * HTML escape
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Default Swagger UI HTML template for custom templates
 */
export function getSwaggerUiTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <link rel="icon" type="image/x-icon" href="{{favicon}}">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  {{customCssUrl}}
  {{customCss}}
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "{{specUrl}}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
      window.ui = ui;
    };
  </script>
  {{customJs}}
</body>
</html>`;
}

/**
 * Default Redoc HTML template for custom templates
 */
export function getRedocTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <link rel="icon" type="image/x-icon" href="{{favicon}}">
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
  {{customCssUrl}}
  {{customCss}}
</head>
<body>
  <redoc spec-url="{{specUrl}}" {{options}}></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  {{customJs}}
</body>
</html>`;
}

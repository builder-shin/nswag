/**
 * HTML 생성기
 * Swagger UI 및 Redoc HTML 페이지 생성
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
 * Swagger UI HTML 페이지 생성
 *
 * @param options - Swagger UI 옵션
 * @returns HTML 문자열
 */
export function generateSwaggerUIHtml(options: SwaggerUiOptions): string {
  // 커스텀 HTML 템플릿 사용
  if (options.customHtmlPath && existsSync(options.customHtmlPath)) {
    return readFileSync(options.customHtmlPath, 'utf-8');
  }

  const title = options.customSiteTitle ?? DEFAULT_SWAGGER_UI_OPTIONS.customSiteTitle;
  const favicon = options.customFavicon ?? '/favicon.ico';

  // 스펙 URL 설정 구성
  const specConfig = buildSpecConfig(options);

  // Swagger UI 설정 객체 구성
  const configObject = {
    dom_id: '#swagger-ui',
    presets: ['SwaggerUIBundle.presets.apis', 'SwaggerUIStandalonePreset'],
    plugins: ['SwaggerUIBundle.plugins.DownloadUrl'],
    layout: 'StandaloneLayout',
    ...DEFAULT_SWAGGER_UI_OPTIONS.configObject,
    ...options.configObject,
    ...specConfig,
  };

  // 설정 객체를 JavaScript 코드로 변환 (presets/plugins는 문자열이 아닌 참조)
  const configJs = buildConfigJs(configObject);

  // CSS 스타일 구성
  const cssStyles = buildCssStyles(options);

  // JavaScript 구성
  const jsScripts = buildJsScripts(options);

  return `<!DOCTYPE html>
<html lang="ko">
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
 * Redoc HTML 페이지 생성
 *
 * @param options - Redoc 옵션
 * @returns HTML 문자열
 */
export function generateRedocHtml(options: RedocOptions): string {
  const title = options.customSiteTitle ?? DEFAULT_REDOC_OPTIONS.customSiteTitle;
  const favicon = options.customFavicon ?? '/favicon.ico';

  // Redoc 옵션 구성
  const redocOptions = {
    ...DEFAULT_REDOC_OPTIONS.options,
    ...options.options,
  };

  // 옵션 속성 문자열
  const optionsAttr = Object.keys(redocOptions).length > 0
    ? ` options='${JSON.stringify(redocOptions)}'`
    : '';

  // CSS 스타일 구성
  const cssStyles = buildCssStyles(options);

  // JavaScript 구성
  const jsScripts = buildJsScripts(options);

  return `<!DOCTYPE html>
<html lang="ko">
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
 * 스펙 URL 설정 구성
 */
function buildSpecConfig(options: SwaggerUiOptions): Record<string, unknown> {
  // 다중 스펙 URL
  if (options.specUrls && options.specUrls.length > 0) {
    const config: Record<string, unknown> = {
      urls: options.specUrls.map((spec: SpecUrl) => ({
        url: spec.url,
        name: spec.name,
      })),
    };

    // 기본 선택 스펙 설정
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

  // 단일 스펙 URL
  if (options.specUrl) {
    return { url: options.specUrl };
  }

  return {};
}

/**
 * 설정 객체를 JavaScript 코드로 변환
 */
function buildConfigJs(config: Record<string, unknown>): string {
  const entries: string[] = [];

  for (const [key, value] of Object.entries(config)) {
    if (key === 'presets' || key === 'plugins') {
      // presets와 plugins는 문자열 배열이 아닌 실제 참조로 변환
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
 * CSS 스타일 구성
 */
function buildCssStyles(options: SwaggerUiOptions | RedocOptions): string {
  const styles: string[] = [];

  // 외부 CSS URL
  if (options.customCssUrl) {
    styles.push(`  <link rel="stylesheet" type="text/css" href="${escapeHtml(options.customCssUrl)}">`);
  }

  // 인라인 CSS
  if (options.customCss) {
    styles.push(`  <style>${options.customCss}</style>`);
  }

  return styles.join('\n');
}

/**
 * JavaScript 구성
 */
function buildJsScripts(options: SwaggerUiOptions | RedocOptions): string {
  if (options.customJs) {
    return `  <script>${options.customJs}</script>`;
  }
  return '';
}

/**
 * HTML 이스케이프
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
 * 커스텀 템플릿용 기본 Swagger UI HTML 템플릿
 */
export function getSwaggerUiTemplate(): string {
  return `<!DOCTYPE html>
<html lang="ko">
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
 * 커스텀 템플릿용 기본 Redoc HTML 템플릿
 */
export function getRedocTemplate(): string {
  return `<!DOCTYPE html>
<html lang="ko">
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

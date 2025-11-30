/**
 * ui 서브커맨드
 * UI 관련 명령어 (ui:custom, ui:copy-assets)
 */

import { existsSync, mkdirSync, writeFileSync, cpSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { logger, Spinner, type ParsedArgs } from '../utils.js';

/**
 * UI 엔진 유형
 */
type UIEngine = 'swagger-ui' | 'redoc';

/**
 * ui:custom 서브커맨드 실행
 * 커스텀 UI 템플릿 생성
 */
export async function runUiCustom(args: ParsedArgs): Promise<void> {
  logger.title('커스텀 UI 템플릿 생성');

  const outputPath = args.args[0] || './views/nswag/ui';
  const fullPath = resolve(process.cwd(), outputPath);
  const force = args.flags.force === true || args.flags.f === true;
  const engine = (args.flags.engine as UIEngine) || 'swagger-ui';

  // 디렉토리 생성
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
    logger.success(`디렉토리 생성됨: ${outputPath}`);
  }

  // 엔진별 커스텀 템플릿 파일 생성
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
      logger.warn(`${filename} 이미 존재함 (덮어쓰려면 --force 사용)`);
      continue;
    }

    writeFileSync(filePath, content, 'utf-8');
    logger.success(`${filename} 생성됨`);
  }

  logger.newline();
  logger.success(`커스텀 ${engine} 템플릿 생성 완료!`);
  logger.newline();
  logger.info('다음 단계:');
  logger.info(`  1. ${outputPath}/config.json에서 스펙 파일 경로 설정`);
  logger.info(`  2. ${outputPath}/custom.css에서 스타일 커스터마이징`);
  if (engine === 'swagger-ui') {
    logger.info(`  3. ${outputPath}/custom.js에서 동작 커스터마이징`);
  }
  logger.newline();
  logger.info('사용 예시:');
  logger.info(`  swaggerUi({ customHtmlPath: '${outputPath}/index.html' })`);
  logger.newline();
}

/**
 * ui:copy-assets 서브커맨드 실행
 * 정적 파일 복사
 */
export async function runUiCopyAssets(args: ParsedArgs): Promise<void> {
  logger.title('UI 정적 파일 복사');

  const outputPath = args.args[0];
  const engine = (args.flags.engine as UIEngine) || 'swagger-ui';

  if (!outputPath) {
    logger.error('출력 경로가 필요합니다');
    logger.info('사용법: npx nswag ui:copy-assets ./public/api-docs');
    logger.info('옵션:');
    logger.info('  --engine swagger-ui|redoc  UI 엔진 선택 (기본: swagger-ui)');
    process.exit(1);
  }

  const fullPath = resolve(process.cwd(), outputPath);
  const spinner = new Spinner(`${engine} 정적 파일 복사 중...`);
  spinner.start();

  try {
    // 출력 디렉토리 생성
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }

    if (engine === 'redoc') {
      // Redoc 정적 파일 생성
      await copyRedocAssets(fullPath);
    } else {
      // Swagger UI 정적 파일 생성
      await copySwaggerUiAssets(fullPath);
    }

    spinner.stop(true);
    logger.newline();
    logger.success(`${engine} 정적 파일 복사 완료: ${outputPath}`);
    logger.newline();
    logger.info('생성된 파일:');
    logger.info(`  ${outputPath}/index.html`);
    if (engine === 'swagger-ui') {
      logger.info(`  ${outputPath}/swagger-initializer.js`);
    }
    logger.newline();
    logger.info('웹 서버에서 이 디렉토리를 서빙하세요.');
    logger.info('예시: npx serve ' + outputPath);
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

/**
 * Swagger UI 정적 파일 복사
 */
async function copySwaggerUiAssets(outputPath: string): Promise<void> {
  // swagger-ui-dist 패키지 경로 찾기
  try {
    const swaggerUiDistPath = findPackagePath('swagger-ui-dist');
    if (swaggerUiDistPath) {
      // 필요한 파일들만 복사
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
    // swagger-ui-dist가 없으면 CDN 버전 사용
    logger.warn('swagger-ui-dist를 찾을 수 없어 CDN 버전을 사용합니다.');
  }

  // index.html 생성
  const indexHtml = getSwaggerUiStaticHtml();
  writeFileSync(join(outputPath, 'index.html'), indexHtml, 'utf-8');

  // swagger-initializer.js 생성
  const initializerJs = getSwaggerUiInitializerJs();
  writeFileSync(join(outputPath, 'swagger-initializer.js'), initializerJs, 'utf-8');
}

/**
 * Redoc 정적 파일 복사
 */
async function copyRedocAssets(outputPath: string): Promise<void> {
  // index.html 생성
  const indexHtml = getRedocStaticHtml();
  writeFileSync(join(outputPath, 'index.html'), indexHtml, 'utf-8');
}

/**
 * 패키지 경로 찾기
 */
function findPackagePath(packageName: string): string | null {
  try {
    const resolvedPath = require.resolve(`${packageName}/package.json`);
    return dirname(resolvedPath);
  } catch {
    return null;
  }
}

// ========== Swagger UI 템플릿 ==========

/**
 * Swagger UI index.html 커스텀 템플릿
 */
function getSwaggerUiIndexHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>

  <!-- Swagger UI -->
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">

  <!-- 커스텀 스타일 -->
  <link rel="stylesheet" href="./custom.css">
</head>
<body>
  <div id="swagger-ui"></div>

  <!-- Swagger UI 스크립트 -->
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>

  <!-- 설정 로드 -->
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
        console.error('설정 로드 실패:', err);
        // 기본 설정으로 실행
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

  <!-- 커스텀 스크립트 -->
  <script src="./custom.js"></script>
</body>
</html>
`;
}

/**
 * Swagger UI custom.css 템플릿
 */
function getSwaggerUiCustomCssTemplate(): string {
  return `/**
 * 커스텀 스타일
 * Swagger UI 스타일을 오버라이드하세요
 */

/* 헤더 스타일 */
.swagger-ui .topbar {
  background-color: #1a1a2e;
}

/* 로고 숨기기 */
.swagger-ui .topbar-wrapper img {
  content: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>');
}

/* 제목 스타일 */
.swagger-ui .info .title {
  color: #333;
  font-weight: 700;
}

/* 작업 태그 스타일 */
.swagger-ui .opblock-tag {
  border-bottom: 1px solid #e0e0e0;
}

/* HTTP 메서드 색상 */
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

/* 반응형 조정 */
@media (max-width: 768px) {
  .swagger-ui .wrapper {
    padding: 0 10px;
  }
}
`;
}

/**
 * Swagger UI custom.js 템플릿
 */
function getSwaggerUiCustomJsTemplate(): string {
  return `/**
 * 커스텀 JavaScript
 * Swagger UI 동작을 확장하세요
 */

// 페이지 로드 완료 시 실행
window.addEventListener('load', function() {
  console.log('API 문서 로드 완료');

  // 예시: 모든 작업을 기본으로 축소
  // setTimeout(() => {
  //   document.querySelectorAll('.opblock').forEach(block => {
  //     if (block.classList.contains('is-open')) {
  //       block.querySelector('.opblock-summary').click();
  //     }
  //   });
  // }, 1000);
});

// API 호출 전 인터셉터 (예시)
// window.ui.getConfigs().requestInterceptor = (request) => {
//   // 인증 헤더 추가 등
//   return request;
// };

// 커스텀 함수들
const apiDocs = {
  // 특정 태그로 스크롤
  scrollToTag: function(tagName) {
    const element = document.querySelector(\`[id="operations-tag-\${tagName}"]\`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  },

  // 모든 작업 펼치기
  expandAll: function() {
    document.querySelectorAll('.opblock:not(.is-open) .opblock-summary').forEach(summary => {
      summary.click();
    });
  },

  // 모든 작업 접기
  collapseAll: function() {
    document.querySelectorAll('.opblock.is-open .opblock-summary').forEach(summary => {
      summary.click();
    });
  },

  // 검색 필터
  filterOperations: function(query) {
    const lowerQuery = query.toLowerCase();
    document.querySelectorAll('.opblock').forEach(block => {
      const text = block.textContent.toLowerCase();
      block.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
  }
};

// 전역에 노출
window.apiDocs = apiDocs;
`;
}

/**
 * Swagger UI config.json 템플릿
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
 * Swagger UI 정적 HTML
 */
function getSwaggerUiStaticHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
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
 * Swagger UI 초기화 스크립트
 */
function getSwaggerUiInitializerJs(): string {
  return `window.onload = function() {
  // 설정을 여기서 커스터마이징하세요
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
    // 추가 설정
    displayRequestDuration: true,
    filter: true,
    persistAuthorization: true
  });

  window.ui = ui;
};
`;
}

// ========== Redoc 템플릿 ==========

/**
 * Redoc index.html 커스텀 템플릿
 */
function getRedocIndexHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">

  <!-- 커스텀 스타일 -->
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

  <!-- 설정 로드 -->
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
        console.error('설정 로드 실패:', err);
        // 기본 설정으로 실행
        Redoc.init('./openapi.json', {}, document.getElementById('redoc-container'));
      });
  </script>
</body>
</html>
`;
}

/**
 * Redoc custom.css 템플릿
 */
function getRedocCustomCssTemplate(): string {
  return `/**
 * 커스텀 스타일
 * Redoc 스타일을 오버라이드하세요
 */

/* 사이드바 스타일 */
.menu-content {
  /* background-color: #fafafa; */
}

/* API 정보 헤더 */
.api-info h1 {
  /* color: #333; */
}

/* HTTP 메서드 배지 색상 */
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

/* 코드 블록 스타일 */
pre code {
  /* font-size: 13px; */
}

/* 반응형 조정 */
@media (max-width: 768px) {
  /* 모바일 스타일 */
}
`;
}

/**
 * Redoc config.json 템플릿
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
 * Redoc 정적 HTML
 */
function getRedocStaticHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
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
  <!-- specUrl을 여기서 수정하세요 -->
  <redoc spec-url="./openapi.json"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
`;
}

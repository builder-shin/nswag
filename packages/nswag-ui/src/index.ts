/**
 * @aspect/nswag-ui
 * Swagger UI 또는 Redoc을 통한 문서 탐색 인터페이스 제공
 *
 * @packageDocumentation
 */

// ========== 타입 내보내기 ==========
export * from './types.js';

// ========== HTML 생성기 ==========
export {
  generateSwaggerUIHtml,
  generateRedocHtml,
  getSwaggerUiTemplate,
  getRedocTemplate,
} from './html-generator.js';

// ========== Basic Auth ==========
export {
  verifyBasicAuth,
  validateBasicAuth,
  createExpressBasicAuthMiddleware,
  createFastifyBasicAuthHook,
  type AuthResult,
} from './basic-auth.js';

// ========== Express 미들웨어 ==========
export {
  swaggerUi,
  redoc,
  setupDocsRouter,
  // 별칭 (레거시 호환)
  createSwaggerUiMiddleware,
  createRedocMiddleware,
} from './express.js';

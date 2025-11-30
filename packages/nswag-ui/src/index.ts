/**
 * @aspect/nswag-ui
 * Provides document browsing interface through Swagger UI or Redoc
 *
 * @packageDocumentation
 */

// ========== Type Exports ==========
export * from './types.js';

// ========== HTML Generator ==========
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

// ========== Express Middleware ==========
export {
  swaggerUi,
  redoc,
  setupDocsRouter,
  // Aliases (for legacy compatibility)
  createSwaggerUiMiddleware,
  createRedocMiddleware,
} from './express.js';

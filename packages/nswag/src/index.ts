/**
 * @builder-shin/nswag
 * OpenAPI specification generation and documentation tool for Node.js - Meta package
 *
 * This package includes all three core modules as a convenience package:
 * - @builder-shin/nswag-specs: OpenAPI-based DSL and test runner integration
 * - @builder-shin/nswag-api: API endpoint middleware
 * - @builder-shin/nswag-ui: Swagger UI / Redoc documentation interface
 */

// Re-export @builder-shin/nswag-specs
export * from '@builder-shin/nswag-specs';

// Re-export @builder-shin/nswag-api (as namespace)
export * as api from '@builder-shin/nswag-api';

// Re-export @builder-shin/nswag-ui (as namespace)
export * as ui from '@builder-shin/nswag-ui';

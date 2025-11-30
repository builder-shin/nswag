/**
 * @aspect/nswag
 * OpenAPI specification generation and documentation tool for Node.js - Meta package
 *
 * This package includes all three core modules as a convenience package:
 * - @aspect/nswag-specs: OpenAPI-based DSL and test runner integration
 * - @aspect/nswag-api: API endpoint middleware
 * - @aspect/nswag-ui: Swagger UI / Redoc documentation interface
 */

// Re-export @aspect/nswag-specs
export * from '@aspect/nswag-specs';

// Re-export @aspect/nswag-api (as namespace)
export * as api from '@aspect/nswag-api';

// Re-export @aspect/nswag-ui (as namespace)
export * as ui from '@aspect/nswag-ui';

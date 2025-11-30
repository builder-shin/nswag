/**
 * Vitest Setup File
 * Performs necessary initialization before test execution
 *
 * @example
 * // vitest.config.ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@aspect/nswag-specs/vitest/setup'],
 *   },
 * });
 */

import type { ConfigureOptions, RequestMetadata, TestContext } from '../types/index.js';
import { configure } from '../testing/configure.js';
import { getContextManager, resetContextManager } from '../testing/context-manager.js';
import { getSpecCollector, resetSpecCollector } from '../testing/spec-collector.js';
import { createHttpClient, resetHttpClient } from '../testing/http-client.js';
import { getResponseValidator } from '../testing/response-validator.js';

// Test framework global function types
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function beforeEach(fn: (context: any) => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;

// Vitest global type extension
declare global {
  var __NSWAG__: NswagGlobal;
}

/**
 * nswag Global API
 */
interface NswagGlobal {
  configure: (options: ConfigureOptions) => void;
  getHttpClient: () => ReturnType<typeof createHttpClient>;
  getContext: () => TestContext | null;
  collect: (metadata: RequestMetadata) => void;
}

// Context manager instance
const contextManager = getContextManager();
const specCollector = getSpecCollector();
const responseValidator = getResponseValidator();

/**
 * Setup Global nswag API
 */
function setupGlobalApi(): void {
  globalThis.__NSWAG__ = {
    configure: (options: ConfigureOptions) => {
      configure(options);
    },
    getHttpClient: () => {
      return createHttpClient();
    },
    getContext: () => {
      return contextManager.getCurrent();
    },
    collect: (metadata: RequestMetadata) => {
      const httpClient = createHttpClient();
      const request = httpClient.getLastRequest();
      const response = httpClient.getLastResponse();

      if (request && response) {
        specCollector.collect(metadata, request, response);

        // Validate response
        const result = responseValidator.validate(metadata, response, 0);
        if (!result.validated && result.validationErrors?.length) {
          console.warn('[nswag-specs] Response validation warning:', result.validationErrors);
        }
      }
    },
  };
}

/**
 * Setup Vitest Hooks
 */
function setupVitestHooks(): void {
  // beforeAll: Start test suite
  if (typeof beforeAll !== 'undefined') {
    beforeAll(() => {
      resetContextManager();
      resetSpecCollector();
      resetHttpClient();
    });
  }

  // afterAll: End test suite
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      // Output spec collection results
      if (specCollector.count > 0) {
        console.log(`[nswag-specs] ${specCollector.count} endpoints collected`);
      }
    });
  }

  // beforeEach: Start each test
  if (typeof beforeEach !== 'undefined') {
    beforeEach((context) => {
      // Get test information from Vitest context
      const testName = (context as { task?: { name?: string } })?.task?.name ?? 'unknown';
      const testFile = (context as { task?: { file?: { name?: string } } })?.task?.file?.name ?? 'unknown';

      contextManager.begin(testName, testFile);
    });
  }

  // afterEach: End each test
  if (typeof afterEach !== 'undefined') {
    afterEach(() => {
      contextManager.end();
    });
  }
}

// Auto-initialize
setupGlobalApi();
setupVitestHooks();

/**
 * Vitest Environment Setup Function (for manual setup)
 *
 * @deprecated Auto-initialization is recommended
 */
export function setupVitest(options?: ConfigureOptions): void {
  if (options) {
    configure(options);
  }
}

/**
 * Get Current Test Context
 */
export function getContext() {
  return contextManager.getCurrent();
}

/**
 * Teardown Test Context
 */
export function teardown(): void {
  resetContextManager();
  resetHttpClient();
}

// Export convenience functions
export { configure } from '../testing/configure.js';
export { createHttpClient } from '../testing/http-client.js';
export { getContextManager, getCurrentTestContext } from '../testing/context-manager.js';
export { getSpecCollector } from '../testing/spec-collector.js';

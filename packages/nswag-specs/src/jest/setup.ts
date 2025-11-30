/**
 * Jest Setup File
 * Used in setupFilesAfterEnv
 * Initializes nswag-specs environment before test execution
 */

import type { ConfigureOptions, RequestMetadata, TestContext } from '../types/index.js';
import { configure } from '../testing/configure.js';
import { getContextManager } from '../testing/context-manager.js';
import { getSpecCollector } from '../testing/spec-collector.js';
import { createHttpClient } from '../testing/http-client.js';
import { getResponseValidator } from '../testing/response-validator.js';

// Test framework global function types
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;

// Jest global type extension
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __NSWAG__: NswagGlobal;
    }
  }
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

/**
 * Setup Global nswag API
 */
function setupGlobalApi(): void {
  const contextManager = getContextManager();
  const specCollector = getSpecCollector();
  const responseValidator = getResponseValidator();

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
 * Setup Jest Hooks
 */
function setupJestHooks(): void {
  const contextManager = getContextManager();

  // beforeAll: Start test suite
  if (typeof beforeAll !== 'undefined') {
    beforeAll(() => {
      // Initialization logic
    });
  }

  // afterAll: End test suite
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      // Output spec collection results (optional)
      const collector = getSpecCollector();
      if (collector.count > 0) {
        console.log(`[nswag-specs] ${collector.count} endpoints collected`);
      }
    });
  }

  // beforeEach: Start each test
  if (typeof beforeEach !== 'undefined') {
    beforeEach(() => {
      // Get current test information (using Jest expect.getState)
      let testName = 'unknown';
      let testPath = 'unknown';

      try {
        // @ts-expect-error Jest internal API
        const state = expect.getState();
        testName = state.currentTestName ?? 'unknown';
        testPath = state.testPath ?? 'unknown';
      } catch {
        // Ignore if Jest API access fails
      }

      contextManager.begin(testName, testPath);
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
setupJestHooks();

// Export convenience functions
export { configure } from '../testing/configure.js';
export { createHttpClient } from '../testing/http-client.js';
export { getContextManager, getCurrentTestContext } from '../testing/context-manager.js';
export { getSpecCollector } from '../testing/spec-collector.js';

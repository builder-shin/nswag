/**
 * Mocha Integration Module
 * Provides integration features with Mocha test framework
 *
 * @example
 * // .mocharc.js
 * module.exports = {
 *   require: ['@aspect/nswag-specs/mocha'],
 * };
 *
 * @example
 * // Using Root Hook Plugin
 * // .mocharc.js
 * module.exports = {
 *   require: ['@aspect/nswag-specs/mocha'],
 *   'root-hooks': true,
 * };
 */

import type { ConfigureOptions, RequestMetadata, TestContext } from '../types/index.js';
import { configure } from '../testing/configure.js';
import { getContextManager, resetContextManager } from '../testing/context-manager.js';
import { getSpecCollector, resetSpecCollector } from '../testing/spec-collector.js';
import { createHttpClient, resetHttpClient } from '../testing/http-client.js';
import { getResponseValidator } from '../testing/response-validator.js';

// Mocha global type extension
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
 * Mocha Root Hook Plugin
 * Uses Mocha 8.0+ Root Hook Plugin API
 *
 * @see https://mochajs.org/#root-hook-plugins
 *
 * @example
 * // .mocharc.js
 * module.exports = {
 *   require: ['@aspect/nswag-specs/mocha'],
 * };
 */
export const mochaHooks = {
  /**
   * Before All Tests (runs once)
   */
  beforeAll(): void {
    setupGlobalApi();
    resetContextManager();
    resetSpecCollector();
    resetHttpClient();
  },

  /**
   * After All Tests (runs once)
   */
  afterAll(): void {
    // Output spec collection results
    if (specCollector.count > 0) {
      console.log(`[nswag-specs] ${specCollector.count} endpoints collected`);
    }
  },

  /**
   * Before Each Test
   */
  beforeEach(): void {
    // Get current test information from Mocha
    // @ts-expect-error Mocha global context
    const currentTest = this?.currentTest || this?.test;
    const testName = currentTest?.title ?? 'unknown';
    const testFile = currentTest?.file ?? 'unknown';

    contextManager.begin(testName, testFile);
  },

  /**
   * After Each Test
   */
  afterEach(): void {
    contextManager.end();
  },
};

/**
 * Mocha Hooks Creation Function (legacy API)
 *
 * @deprecated Use mochaHooks export instead
 */
export function createMochaHooks(options?: ConfigureOptions) {
  if (options) {
    configure(options);
  }

  return {
    beforeAll: mochaHooks.beforeAll,
    afterAll: mochaHooks.afterAll,
    beforeEach: mochaHooks.beforeEach,
    afterEach: mochaHooks.afterEach,
  };
}

/**
 * Mocha Environment Setup Function
 *
 * @deprecated Use mochaHooks export instead
 */
export function setupMocha(options?: ConfigureOptions): void {
  setupGlobalApi();
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

/**
 * Mocha Test Environment Options Type
 */
export interface MochaTestEnvironmentOptions {
  /** VCR mode: record, playback, none */
  vcrMode?: 'record' | 'playback' | 'none';
  /** Spec output path */
  outputSpec?: string;
  /** Enable response validation */
  validateResponses?: boolean;
}

// Auto-initialize (runs automatically on require)
setupGlobalApi();

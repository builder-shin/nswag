/**
 * Vitest Integration Module
 * Provides integration features with Vitest test framework
 *
 * @example
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config';
 * import { nswagPlugin } from '@aspect/nswag-specs/vitest';
 *
 * export default defineConfig({
 *   plugins: [nswagPlugin()],
 *   test: {
 *     setupFiles: ['@aspect/nswag-specs/vitest/setup'],
 *   },
 * });
 */

export { nswagPlugin, type NswagPluginOptions } from './plugin.js';
export { setupVitest, getContext, teardown } from './setup.js';
export * from './setup.js';

/**
 * Helper to create Vitest configuration
 *
 * @example
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config';
 * import { createVitestConfig } from '@aspect/nswag-specs/vitest';
 *
 * const nswagConfig = createVitestConfig();
 * export default defineConfig({
 *   ...nswagConfig,
 * });
 */
export function createVitestConfig(options?: {
  setupFiles?: string[];
  vcrMode?: 'record' | 'playback' | 'none';
  outputSpec?: string;
}) {
  return {
    test: {
      setupFiles: [
        '@aspect/nswag-specs/vitest/setup',
        ...(options?.setupFiles ?? []),
      ],
      // Global configuration
      globals: true,
    },
  };
}

/**
 * Vitest test environment options type
 */
export interface VitestTestEnvironmentOptions {
  /** VCR mode: record, playback, none */
  vcrMode?: 'record' | 'playback' | 'none';
  /** Spec output path */
  outputSpec?: string;
  /** Enable response validation */
  validateResponses?: boolean;
}

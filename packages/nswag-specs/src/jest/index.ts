/**
 * Jest Integration Module
 * Provides integration features with Jest test framework
 *
 * @example
 * // jest.config.js
 * module.exports = {
 *   testEnvironment: '@aspect/nswag-specs/jest/environment',
 *   setupFilesAfterEnv: ['@aspect/nswag-specs/jest/setup'],
 * };
 */

export { NswagTestEnvironment, JestEnvironment } from './environment.js';
export * from './setup.js';

/**
 * Helper to create Jest configuration
 *
 * @example
 * // jest.config.js
 * const { createJestConfig } = require('@aspect/nswag-specs/jest');
 * module.exports = createJestConfig({ rootDir: __dirname });
 */
export function createJestConfig(options?: {
  rootDir?: string;
  vcrMode?: 'record' | 'playback' | 'none';
  outputSpec?: string;
}) {
  return {
    testEnvironment: '@aspect/nswag-specs/jest/environment',
    setupFilesAfterEnv: ['@aspect/nswag-specs/jest/setup'],
    rootDir: options?.rootDir ?? process.cwd(),
    testEnvironmentOptions: {
      vcrMode: options?.vcrMode,
      outputSpec: options?.outputSpec,
    },
  };
}

/**
 * Jest test environment options type
 */
export interface JestTestEnvironmentOptions {
  /** VCR mode: record, playback, none */
  vcrMode?: 'record' | 'playback' | 'none';
  /** Spec output path */
  outputSpec?: string;
  /** Enable response validation */
  validateResponses?: boolean;
}

/**
 * Config module
 * nswag.config.ts loader and config utilities
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

import type {
  NswagConfig,
  ResolvedNswagConfig,
  EnvironmentConfig,
} from './types.js';

export type {
  NswagConfig,
  ResolvedNswagConfig,
  NswagPlugin,
  TestFramework,
  EnvironmentConfig,
} from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ResolvedNswagConfig = {
  testFramework: 'jest',
  testPatterns: [
    'spec/requests/**/*_spec.ts',
    'spec/api/**/*_spec.ts',
    'spec/integration/**/*_spec.ts',
  ],
  testTimeout: 30000,
  dryRun: true,
  plugins: [],
  outputDir: './openapi',
  outputFormat: 'json',
  outputFileName: 'openapi',
  openapi: {
    title: 'API Documentation',
    version: '1.0.0',
    description: '',
  },
  watch: {
    patterns: ['spec/**/*.ts'],
    ignore: ['node_modules/**', 'dist/**'],
  },
};

/**
 * Config file name list (in order of priority)
 */
const CONFIG_FILE_NAMES = [
  'nswag.config.ts',
  'nswag.config.js',
  'nswag.config.mjs',
  'nswag.config.cjs',
];

/**
 * Config object definition helper function
 * Wrapper for TypeScript type support
 *
 * @param config - User configuration
 * @returns Configuration object returned as-is
 *
 * @example
 * ```typescript
 * // nswag.config.ts
 * import { defineConfig } from '@builder-shin/nswag-specs';
 *
 * export default defineConfig({
 *   testFramework: 'vitest',
 *   testPatterns: ['spec/requests/**\/*_spec.ts'],
 *   dryRun: false,
 * });
 * ```
 */
export function defineConfig(config: NswagConfig): NswagConfig {
  return config;
}

/**
 * Read configuration from environment variables
 *
 * @returns Environment variable-based configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const envConfig: EnvironmentConfig = {};

  // PATTERN environment variable
  const pattern = process.env.PATTERN;
  if (pattern) {
    envConfig.pattern = pattern;
  }

  // NSWAG_DRY_RUN environment variable
  const dryRunEnv = process.env.NSWAG_DRY_RUN;
  if (dryRunEnv !== undefined) {
    // Disable if "0" or "false", otherwise enable
    envConfig.dryRun = dryRunEnv !== '0' && dryRunEnv.toLowerCase() !== 'false';
  }

  // ADDITIONAL_TEST_OPTS environment variable
  const additionalOpts = process.env.ADDITIONAL_TEST_OPTS;
  if (additionalOpts) {
    envConfig.additionalTestOpts = additionalOpts;
  }

  return envConfig;
}

/**
 * Find config file path
 *
 * @param cwd - Directory to start searching from
 * @returns Config file path or null
 */
export function findConfigFile(cwd: string = process.cwd()): string | null {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(cwd, fileName);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Load config file
 *
 * @param configPath - Config file path (auto-discover if not provided)
 * @returns Loaded configuration or empty object
 */
export async function loadConfigFile(configPath?: string): Promise<NswagConfig> {
  const filePath = configPath || findConfigFile();

  if (!filePath) {
    return {};
  }

  try {
    // TypeScript files may require ts-node or tsx loader
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);
    return module.default || module;
  } catch (error) {
    // If .ts file cannot be imported directly,
    // look for compiled .js file or throw error
    const jsPath = filePath.replace(/\.ts$/, '.js');
    if (existsSync(jsPath)) {
      try {
        const fileUrl = pathToFileURL(jsPath).href;
        const module = await import(fileUrl);
        return module.default || module;
      } catch {
        // ignore
      }
    }

    console.warn(`Failed to load config file: ${filePath}`);
    console.warn('Using default configuration.');
    return {};
  }
}

/**
 * Resolve configuration
 * Merge user config, environment variables, and defaults
 *
 * @param userConfig - User configuration
 * @param envConfig - Environment variable configuration
 * @returns Resolved complete configuration
 */
export function resolveConfig(
  userConfig: NswagConfig,
  envConfig: EnvironmentConfig = {}
): ResolvedNswagConfig {
  // Apply environment variables first
  let testPatterns = userConfig.testPatterns || DEFAULT_CONFIG.testPatterns;
  if (envConfig.pattern) {
    testPatterns = [envConfig.pattern];
  }

  let dryRun = userConfig.dryRun ?? DEFAULT_CONFIG.dryRun;
  if (envConfig.dryRun !== undefined) {
    dryRun = envConfig.dryRun;
  }

  return {
    testFramework: userConfig.testFramework || DEFAULT_CONFIG.testFramework,
    testPatterns,
    testTimeout: userConfig.testTimeout ?? DEFAULT_CONFIG.testTimeout,
    dryRun,
    plugins: userConfig.plugins || DEFAULT_CONFIG.plugins,
    outputDir: userConfig.outputDir || DEFAULT_CONFIG.outputDir,
    outputFormat: userConfig.outputFormat || DEFAULT_CONFIG.outputFormat,
    outputFileName: userConfig.outputFileName || DEFAULT_CONFIG.outputFileName,
    openapi: {
      title: userConfig.openapi?.title || DEFAULT_CONFIG.openapi.title,
      version: userConfig.openapi?.version || DEFAULT_CONFIG.openapi.version,
      description: userConfig.openapi?.description || DEFAULT_CONFIG.openapi.description,
    },
    watch: {
      patterns: userConfig.watch?.patterns || DEFAULT_CONFIG.watch.patterns,
      ignore: userConfig.watch?.ignore || DEFAULT_CONFIG.watch.ignore,
    },
  };
}

/**
 * Load and resolve configuration in one step
 *
 * @param configPath - Config file path (optional)
 * @returns Resolved configuration
 */
export async function loadConfig(configPath?: string): Promise<ResolvedNswagConfig> {
  const userConfig = await loadConfigFile(configPath);
  const envConfig = getEnvironmentConfig();
  return resolveConfig(userConfig, envConfig);
}

/**
 * Validate configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateConfig(config: NswagConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate test framework
  if (config.testFramework && !['jest', 'vitest', 'mocha'].includes(config.testFramework)) {
    errors.push(`Invalid testFramework: ${config.testFramework}`);
  }

  // Validate output format
  if (config.outputFormat && !['json', 'yaml'].includes(config.outputFormat)) {
    errors.push(`Invalid outputFormat: ${config.outputFormat}`);
  }

  // Validate test timeout
  if (config.testTimeout !== undefined && config.testTimeout < 0) {
    errors.push(`testTimeout must be greater than or equal to 0: ${config.testTimeout}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

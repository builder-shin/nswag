/**
 * Config type definitions
 */

/**
 * Test framework type
 */
export type TestFramework = 'jest' | 'vitest' | 'mocha';

/**
 * NswagPlugin interface
 */
export interface NswagPlugin {
  /** Plugin name */
  name: string;
  /** Setup hook */
  setup?: (config: NswagConfig) => void | Promise<void>;
  /** Pre-generation hook */
  beforeGenerate?: (spec: unknown) => void | Promise<void>;
  /** Post-generation hook */
  afterGenerate?: (spec: unknown, outputPath: string) => void | Promise<void>;
}

/**
 * Nswag configuration interface
 */
export interface NswagConfig {
  /**
   * Test framework
   * @default 'jest'
   */
  testFramework?: TestFramework;

  /**
   * Test file search patterns
   * Glob pattern array
   * @default ['spec/requests/**\/*_spec.ts']
   */
  testPatterns?: string[];

  /**
   * Test timeout (milliseconds)
   * @default 30000
   */
  testTimeout?: number;

  /**
   * Dry-run mode
   * If true, doesn't actually generate spec files
   * @default true
   */
  dryRun?: boolean;

  /**
   * Plugin array
   */
  plugins?: NswagPlugin[];

  /**
   * Output directory
   * @default './openapi'
   */
  outputDir?: string;

  /**
   * Output format
   * @default 'json'
   */
  outputFormat?: 'json' | 'yaml';

  /**
   * Spec filename (without extension)
   * @default 'openapi'
   */
  outputFileName?: string;

  /**
   * OpenAPI information
   */
  openapi?: {
    title?: string;
    version?: string;
    description?: string;
  };

  /**
   * Watch mode settings
   */
  watch?: {
    /** File patterns to watch */
    patterns?: string[];
    /** File patterns to ignore */
    ignore?: string[];
  };
}

/**
 * Resolved configuration interface
 * All required values filled with defaults
 */
export interface ResolvedNswagConfig {
  testFramework: TestFramework;
  testPatterns: string[];
  testTimeout: number;
  dryRun: boolean;
  plugins: NswagPlugin[];
  outputDir: string;
  outputFormat: 'json' | 'yaml';
  outputFileName: string;
  openapi: {
    title: string;
    version: string;
    description: string;
  };
  watch: {
    patterns: string[];
    ignore: string[];
  };
}

/**
 * CLI environment variable configuration
 */
export interface EnvironmentConfig {
  /** Test file pattern (PATTERN) */
  pattern?: string;
  /** dry-run mode (NSWAG_DRY_RUN) */
  dryRun?: boolean;
  /** Additional test options (ADDITIONAL_TEST_OPTS) */
  additionalTestOpts?: string;
}

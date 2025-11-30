/**
 * generate subcommand
 * Run tests and generate OpenAPI spec
 */

import { existsSync, mkdirSync, writeFileSync, watch as fsWatch } from 'fs';
import { resolve, join } from 'path';
import { spawn } from 'child_process';
import { loadConfig, type ResolvedNswagConfig } from '../../config/index.js';
import { logger, Spinner, formatDuration, type ParsedArgs, colorize } from '../utils.js';

/**
 * Run generate command
 */
export async function runGenerate(args: ParsedArgs): Promise<void> {
  const configPath = args.flags.config as string | undefined || args.flags.c as string | undefined;
  const watchMode = args.flags.watch === true || args.flags.w === true;

  logger.title('Generate OpenAPI spec');

  // Load configuration
  const config = await loadConfig(configPath);
  logConfig(config);

  if (watchMode) {
    await runWatchMode(config);
  } else {
    await runOnce(config);
  }
}

/**
 * Log configuration
 */
function logConfig(config: ResolvedNswagConfig): void {
  logger.info(`Test framework: ${colorize(config.testFramework, 'cyan')}`);
  logger.info(`Test patterns: ${config.testPatterns.join(', ')}`);
  logger.info(`Dry-run mode: ${config.dryRun ? 'enabled' : 'disabled'}`);
  logger.info(`Output: ${config.outputDir}/${config.outputFileName}.${config.outputFormat}`);
  logger.newline();
}

/**
 * Single run
 */
async function runOnce(config: ResolvedNswagConfig): Promise<void> {
  const startTime = Date.now();
  const spinner = new Spinner('Running tests...');
  spinner.start();

  try {
    // Run tests
    const testResult = await runTests(config);

    if (!testResult.success) {
      spinner.stop(false);
      logger.error('Tests failed');
      if (testResult.output) {
        console.log(testResult.output);
      }
      process.exit(1);
    }

    spinner.update('Generating spec file...');

    // Generate spec file
    if (!config.dryRun) {
      await generateSpecFile(config);
    }

    spinner.stop(true);

    const duration = Date.now() - startTime;
    logger.newline();
    logger.success(`Completed! (${formatDuration(duration)})`);

    if (config.dryRun) {
      logger.warn('Dry-run mode: Actual spec file was not generated.');
      logger.info('To generate actual file: NSWAG_DRY_RUN=0 npx nswag generate');
    }
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

/**
 * Run watch mode
 */
async function runWatchMode(config: ResolvedNswagConfig): Promise<void> {
  logger.info('Starting watch mode...');
  logger.info('Spec will be regenerated automatically when changes are detected.');
  logger.info('Press Ctrl+C to exit.');
  logger.newline();

  // Initial run
  await runOnce(config);

  // Watch files
  const watchPatterns = config.watch.patterns;
  const watchDirs = new Set<string>();

  // Extract directories to watch
  for (const pattern of watchPatterns) {
    const parts = pattern.split('*');
    const firstPart = parts[0] ?? '';
    const baseDir = firstPart.replace(/\/$/, '') || '.';
    if (existsSync(baseDir)) {
      watchDirs.add(baseDir);
    }
  }

  // Debounce timer
  let debounceTimer: NodeJS.Timeout | null = null;
  const debounceDelay = 500;

  // Watch each directory
  for (const dir of watchDirs) {
    fsWatch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;

      // Check if file should be ignored
      const shouldIgnore = config.watch.ignore.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filename);
      });

      if (shouldIgnore) return;

      // Process only TypeScript files
      if (!filename.endsWith('.ts') && !filename.endsWith('.js')) return;

      // Debounce handling
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        logger.newline();
        logger.info(`File change detected: ${filename}`);
        try {
          await runOnce(config);
        } catch (error) {
          logger.error(`Regeneration failed: ${error instanceof Error ? error.message : error}`);
        }
      }, debounceDelay);
    });

    logger.debug(`Watching: ${dir}`);
  }

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Run tests
 */
async function runTests(config: ResolvedNswagConfig): Promise<{ success: boolean; output?: string }> {
  const { testFramework, testPatterns, testTimeout } = config;

  // Determine test runner command
  let command: string;
  let args: string[] = [];

  switch (testFramework) {
    case 'jest':
      command = 'npx';
      args = ['jest', '--passWithNoTests', '--testTimeout', String(testTimeout)];
      if (testPatterns.length > 0) {
        args.push('--testPathPattern', testPatterns.join('|'));
      }
      break;

    case 'vitest':
      command = 'npx';
      args = ['vitest', 'run'];
      if (testPatterns.length > 0) {
        // vitest uses include option for patterns
        args.push('--include', testPatterns.join(','));
      }
      break;

    case 'mocha':
      command = 'npx';
      args = ['mocha', '--timeout', String(testTimeout), ...testPatterns];
      break;

    default:
      throw new Error(`Unsupported test framework: ${testFramework}`);
  }

  // Handle ADDITIONAL_TEST_OPTS environment variable
  const additionalOpts = process.env.ADDITIONAL_TEST_OPTS;
  if (additionalOpts) {
    args.push(...additionalOpts.split(' ').filter(Boolean));
  }

  return new Promise((resolve) => {
    let output = '';

    const proc = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Enable spec collection mode
        NSWAG_COLLECT_SPECS: '1',
      },
      shell: true,
    });

    proc.stdout?.on('data', (data) => {
      output += data.toString();
      if (process.env.DEBUG) {
        process.stdout.write(data);
      }
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
      if (process.env.DEBUG) {
        process.stderr.write(data);
      }
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: code !== 0 ? output : undefined,
      });
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        output: error.message,
      });
    });
  });
}

/**
 * Generate spec file
 */
async function generateSpecFile(config: ResolvedNswagConfig): Promise<void> {
  const { outputDir, outputFormat, outputFileName, openapi } = config;

  // Create output directory
  const outputPath = resolve(process.cwd(), outputDir);
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  // Spec file path
  const specFilePath = join(outputPath, `${outputFileName}.${outputFormat}`);

  // Load collected spec data (from temporary file)
  const tempSpecPath = resolve(process.cwd(), '.nswag-temp-spec.json');
  let specData: Record<string, unknown> = {};

  if (existsSync(tempSpecPath)) {
    try {
      const { readFileSync, unlinkSync } = await import('fs');
      const content = readFileSync(tempSpecPath, 'utf-8');
      specData = JSON.parse(content);
      unlinkSync(tempSpecPath); // Delete temporary file
    } catch {
      // Ignore
    }
  }

  // Create OpenAPI spec structure
  const spec = {
    openapi: '3.0.3',
    info: {
      title: openapi.title,
      version: openapi.version,
      description: openapi.description,
    },
    paths: specData.paths || {},
    components: specData.components || {},
    servers: specData.servers || [],
    tags: specData.tags || [],
  };

  // Save according to format
  if (outputFormat === 'yaml') {
    const { stringify } = await import('yaml');
    writeFileSync(specFilePath, stringify(spec), 'utf-8');
  } else {
    writeFileSync(specFilePath, JSON.stringify(spec, null, 2), 'utf-8');
  }

  logger.success(`Spec file generated: ${specFilePath}`);
}

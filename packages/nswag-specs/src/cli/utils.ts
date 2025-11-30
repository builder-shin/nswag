/**
 * CLI utilities
 * Common CLI helper functions
 */

/**
 * ANSI color codes
 */
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Text colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * Color application helper
 */
export function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Logging utility
 */
export const logger = {
  info(message: string): void {
    console.log(colorize('ℹ', 'blue'), message);
  },

  success(message: string): void {
    console.log(colorize('✓', 'green'), message);
  },

  warn(message: string): void {
    console.log(colorize('⚠', 'yellow'), message);
  },

  error(message: string): void {
    console.error(colorize('✗', 'red'), message);
  },

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(colorize('🔍', 'dim'), message);
    }
  },

  title(message: string): void {
    console.log();
    console.log(colorize(colorize(message, 'bright'), 'cyan'));
    console.log();
  },

  newline(): void {
    console.log();
  },
};

/**
 * CLI argument parser
 */
export interface ParsedArgs {
  command: string;
  subCommand?: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parse CLI arguments
 *
 * @param argv - process.argv
 * @returns Parsed arguments
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [, , command = 'generate', ...rest] = argv;

  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  // Handle namespaced commands (e.g., ui:custom)
  const [mainCommand, subCommand] = command.split(':');

  let i = 0;
  while (i < rest.length) {
    const arg = rest[i];
    if (!arg) {
      i++;
      continue;
    }

    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      const value = parts[1];
      if (key) {
        if (value !== undefined) {
          flags[key] = value;
        } else {
          const nextArg = rest[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            flags[key] = nextArg;
            i++;
          } else {
            flags[key] = true;
          }
        }
      }
    } else if (arg.startsWith('-')) {
      // Handle short flags
      const key = arg.slice(1);
      if (key) {
        const nextArg = rest[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          flags[key] = nextArg;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      args.push(arg);
    }

    i++;
  }

  return {
    command: mainCommand || 'generate',
    subCommand,
    args,
    flags,
  };
}

/**
 * Spinner utility (simple version)
 */
export class Spinner {
  private interval?: NodeJS.Timeout;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    process.stdout.write(`\r${this.frames[0]} ${this.message}`);
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      process.stdout.write(`\r${this.frames[this.frameIndex]} ${this.message}`);
    }, 80);
  }

  stop(success: boolean = true): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    const icon = success ? colorize('✓', 'green') : colorize('✗', 'red');
    process.stdout.write(`\r${icon} ${this.message}\n`);
  }

  update(message: string): void {
    this.message = message;
  }
}

/**
 * Print version
 */
export async function printVersion(): Promise<void> {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json');
    console.log(`nswag v${pkg.version}`);
  } catch {
    console.log('nswag v0.0.1');
  }
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
${colorize('nswag', 'bright')} - OpenAPI spec generation and documentation tool

${colorize('Usage:', 'yellow')}
  npx nswag [command] [options]

${colorize('Commands:', 'yellow')}
  init                    Create initial configuration file
  generate                Generate OpenAPI spec (default command)
  validate                Validate spec
  diff                    Compare specs (detect breaking changes)
  ui:custom               Create custom UI template
  ui:copy-assets <path>   Copy static files
  mock:start              Start mocking server

${colorize('Options:', 'yellow')}
  --config, -c <path>     Configuration file path
  --watch, -w             Watch mode
  --help, -h              Show help
  --version, -v           Show version

${colorize('Environment Variables:', 'yellow')}
  PATTERN                 Test file search pattern
  NSWAG_DRY_RUN          Dry-run mode ("0": disable)
  ADDITIONAL_TEST_OPTS    Additional test runner options

${colorize('Examples:', 'yellow')}
  npx nswag init
  npx nswag generate --watch
  NSWAG_DRY_RUN=0 npx nswag generate
  npx nswag diff --base ./openapi/v1/openapi.json
  npx nswag mock:start --spec ./openapi/v1/openapi.yaml --port 4000
`);
}

/**
 * Error handling helper
 */
export function handleError(error: unknown): never {
  if (error instanceof Error) {
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  } else {
    logger.error(String(error));
  }
  process.exit(1);
}

/**
 * Format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

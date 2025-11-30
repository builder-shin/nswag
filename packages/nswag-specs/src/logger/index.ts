/**
 * Debug logger
 * Implemented with debug package integration
 *
 * Usage:
 * DEBUG=nswag:* npx nswag generate
 * DEBUG=nswag:validation npx nswag generate
 * DEBUG=nswag:generate npx nswag generate
 * DEBUG=nswag:test npx nswag generate
 */

// Log level definition
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Logger interface
export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  enabled: boolean;
}

// Debug namespace definition
export type DebugNamespace =
  | 'nswag'
  | 'nswag:validation'
  | 'nswag:generate'
  | 'nswag:test'
  | 'nswag:mock'
  | 'nswag:plugin'
  | 'nswag:config'
  | 'nswag:compare';

// Check if debug is enabled based on environment variable
function isDebugEnabled(namespace: string): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }

  const debugEnv = process.env.DEBUG || '';
  if (!debugEnv) {
    return false;
  }

  const patterns = debugEnv.split(',').map((p) => p.trim());

  for (const pattern of patterns) {
    if (pattern === namespace) {
      return true;
    }

    // Support wildcard patterns (e.g., nswag:*)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (namespace.startsWith(prefix)) {
        return true;
      }
    }

    // Support negative patterns (e.g., -nswag:verbose)
    if (pattern.startsWith('-')) {
      const negatedPattern = pattern.slice(1);
      if (namespace === negatedPattern) {
        return false;
      }
      if (negatedPattern.endsWith('*')) {
        const prefix = negatedPattern.slice(0, -1);
        if (namespace.startsWith(prefix)) {
          return false;
        }
      }
    }
  }

  return false;
}

// Color codes (for terminal output)
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Color assignment by namespace
const namespaceColors: Record<string, string> = {
  'nswag': colors.cyan,
  'nswag:validation': colors.green,
  'nswag:generate': colors.blue,
  'nswag:test': colors.magenta,
  'nswag:mock': colors.yellow,
  'nswag:plugin': colors.cyan,
  'nswag:config': colors.dim,
  'nswag:compare': colors.green,
};

// Color by log level
const levelColors: Record<LogLevel, string> = {
  debug: colors.dim,
  info: colors.blue,
  warn: colors.yellow,
  error: colors.red,
};

// Timestamp format
function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

// Convert arguments to string
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

// Create debug logger
function createDebugger(namespace: DebugNamespace): Logger {
  const enabled = isDebugEnabled(namespace);
  const nsColor = namespaceColors[namespace] || colors.cyan;
  const isTTY = typeof process !== 'undefined' && process.stdout?.isTTY;

  const log = (level: LogLevel, ...args: unknown[]): void => {
    if (!enabled) return;

    const timestamp = formatTimestamp();
    const message = formatArgs(args);
    const levelColor = levelColors[level];

    if (isTTY) {
      // Color output (terminal)
      console.log(
        `${colors.dim}${timestamp}${colors.reset} ` +
        `${nsColor}${namespace}${colors.reset} ` +
        `${levelColor}[${level.toUpperCase()}]${colors.reset} ` +
        message
      );
    } else {
      // Plain text output (file redirection, etc.)
      console.log(`${timestamp} ${namespace} [${level.toUpperCase()}] ${message}`);
    }
  };

  return {
    debug: (...args: unknown[]) => log('debug', ...args),
    info: (...args: unknown[]) => log('info', ...args),
    warn: (...args: unknown[]) => log('warn', ...args),
    error: (...args: unknown[]) => log('error', ...args),
    enabled,
  };
}

// Predefined loggers
export const loggers = {
  /** General logger */
  main: createDebugger('nswag'),
  /** Validation logger */
  validation: createDebugger('nswag:validation'),
  /** Generation logger */
  generate: createDebugger('nswag:generate'),
  /** Test logger */
  test: createDebugger('nswag:test'),
  /** Mock server logger */
  mock: createDebugger('nswag:mock'),
  /** Plugin logger */
  plugin: createDebugger('nswag:plugin'),
  /** Configuration logger */
  config: createDebugger('nswag:config'),
  /** Spec comparison logger */
  compare: createDebugger('nswag:compare'),
};

// Default exports
export const debug = loggers.main;
export const debugValidation = loggers.validation;
export const debugGenerate = loggers.generate;
export const debugTest = loggers.test;
export const debugMock = loggers.mock;
export const debugPlugin = loggers.plugin;
export const debugConfig = loggers.config;
export const debugCompare = loggers.compare;

/**
 * Create logger with custom namespace
 * @param namespace Namespace (e.g., 'nswag:my-plugin')
 */
export function createLogger(namespace: string): Logger {
  return createDebugger(namespace as DebugNamespace);
}

/**
 * Check if specific namespace is enabled
 */
export function isNamespaceEnabled(namespace: string): boolean {
  return isDebugEnabled(namespace);
}

/**
 * Function execution time measurement helper
 */
export function measureTime<T>(
  logger: Logger,
  label: string,
  fn: () => T
): T {
  if (!logger.enabled) {
    return fn();
  }

  const start = performance.now();
  try {
    const result = fn();
    const duration = (performance.now() - start).toFixed(2);
    logger.debug(`${label} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = (performance.now() - start).toFixed(2);
    logger.error(`${label} failed after ${duration}ms`, error);
    throw error;
  }
}

/**
 * Async function execution time measurement helper
 */
export async function measureTimeAsync<T>(
  logger: Logger,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!logger.enabled) {
    return fn();
  }

  const start = performance.now();
  try {
    const result = await fn();
    const duration = (performance.now() - start).toFixed(2);
    logger.debug(`${label} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = (performance.now() - start).toFixed(2);
    logger.error(`${label} failed after ${duration}ms`, error);
    throw error;
  }
}

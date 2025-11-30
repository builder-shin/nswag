/**
 * 디버그 로거
 * debug 패키지 통합으로 구현
 *
 * 사용법:
 * DEBUG=nswag:* npx nswag generate
 * DEBUG=nswag:validation npx nswag generate
 * DEBUG=nswag:generate npx nswag generate
 * DEBUG=nswag:test npx nswag generate
 */

// 로그 레벨 정의
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 로거 인터페이스
export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  enabled: boolean;
}

// 디버그 네임스페이스 정의
export type DebugNamespace =
  | 'nswag'
  | 'nswag:validation'
  | 'nswag:generate'
  | 'nswag:test'
  | 'nswag:mock'
  | 'nswag:plugin'
  | 'nswag:config'
  | 'nswag:compare';

// 환경변수 기반 디버그 활성화 체크
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

    // 와일드카드 패턴 지원 (예: nswag:*)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (namespace.startsWith(prefix)) {
        return true;
      }
    }

    // 부정 패턴 지원 (예: -nswag:verbose)
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

// 색상 코드 (터미널 출력용)
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

// 네임스페이스별 색상 할당
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

// 로그 레벨별 색상
const levelColors: Record<LogLevel, string> = {
  debug: colors.dim,
  info: colors.blue,
  warn: colors.yellow,
  error: colors.red,
};

// 타임스탬프 포맷
function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

// 인자를 문자열로 변환
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

// 디버그 로거 생성
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
      // 컬러 출력 (터미널)
      console.log(
        `${colors.dim}${timestamp}${colors.reset} ` +
        `${nsColor}${namespace}${colors.reset} ` +
        `${levelColor}[${level.toUpperCase()}]${colors.reset} ` +
        message
      );
    } else {
      // 플레인 텍스트 출력 (파일 리다이렉션 등)
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

// 사전 정의된 로거들
export const loggers = {
  /** 일반 로거 */
  main: createDebugger('nswag'),
  /** 검증 로거 */
  validation: createDebugger('nswag:validation'),
  /** 생성 로거 */
  generate: createDebugger('nswag:generate'),
  /** 테스트 로거 */
  test: createDebugger('nswag:test'),
  /** Mock 서버 로거 */
  mock: createDebugger('nswag:mock'),
  /** 플러그인 로거 */
  plugin: createDebugger('nswag:plugin'),
  /** 설정 로거 */
  config: createDebugger('nswag:config'),
  /** 스펙 비교 로거 */
  compare: createDebugger('nswag:compare'),
};

// 기본 내보내기
export const debug = loggers.main;
export const debugValidation = loggers.validation;
export const debugGenerate = loggers.generate;
export const debugTest = loggers.test;
export const debugMock = loggers.mock;
export const debugPlugin = loggers.plugin;
export const debugConfig = loggers.config;
export const debugCompare = loggers.compare;

/**
 * 커스텀 네임스페이스로 로거 생성
 * @param namespace 네임스페이스 (예: 'nswag:my-plugin')
 */
export function createLogger(namespace: string): Logger {
  return createDebugger(namespace as DebugNamespace);
}

/**
 * 특정 네임스페이스가 활성화되어 있는지 확인
 */
export function isNamespaceEnabled(namespace: string): boolean {
  return isDebugEnabled(namespace);
}

/**
 * 함수 실행 시간 측정 헬퍼
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
 * 비동기 함수 실행 시간 측정 헬퍼
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

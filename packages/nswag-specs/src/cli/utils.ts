/**
 * CLI 유틸리티
 * 공통 CLI 헬퍼 함수들
 */

/**
 * ANSI 색상 코드
 */
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // 텍스트 색상
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // 배경 색상
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * 색상 적용 헬퍼
 */
export function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * 로깅 유틸리티
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
 * CLI 인자 파서
 */
export interface ParsedArgs {
  command: string;
  subCommand?: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

/**
 * CLI 인자 파싱
 *
 * @param argv - process.argv
 * @returns 파싱된 인자
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const [, , command = 'generate', ...rest] = argv;

  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  // 네임스페이스 명령어 처리 (e.g., ui:custom)
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
      // 짧은 플래그 처리
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
 * 스피너 유틸리티 (간단한 버전)
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
 * 버전 출력
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
 * 도움말 출력
 */
export function printHelp(): void {
  console.log(`
${colorize('nswag', 'bright')} - OpenAPI 스펙 생성 및 문서화 도구

${colorize('사용법:', 'yellow')}
  npx nswag [command] [options]

${colorize('명령어:', 'yellow')}
  init                    초기 설정 파일 생성
  generate                OpenAPI 스펙 생성 (기본 명령어)
  validate                스펙 검증
  diff                    스펙 비교 (Breaking Change 감지)
  ui:custom               커스텀 UI 템플릿 생성
  ui:copy-assets <path>   정적 파일 복사
  mock:start              모킹 서버 시작

${colorize('옵션:', 'yellow')}
  --config, -c <path>     설정 파일 경로
  --watch, -w             감시 모드
  --help, -h              도움말 출력
  --version, -v           버전 출력

${colorize('환경 변수:', 'yellow')}
  PATTERN                 테스트 파일 검색 패턴
  NSWAG_DRY_RUN          dry-run 모드 ("0": 비활성화)
  ADDITIONAL_TEST_OPTS    테스트 러너 추가 옵션

${colorize('예제:', 'yellow')}
  npx nswag init
  npx nswag generate --watch
  NSWAG_DRY_RUN=0 npx nswag generate
  npx nswag diff --base ./openapi/v1/openapi.json
  npx nswag mock:start --spec ./openapi/v1/openapi.yaml --port 4000
`);
}

/**
 * 에러 핸들링 헬퍼
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
 * 시간 포맷
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
 * 파일 크기 포맷
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

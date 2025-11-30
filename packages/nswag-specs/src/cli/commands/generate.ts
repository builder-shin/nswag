/**
 * generate 서브커맨드
 * 테스트 실행 및 OpenAPI 스펙 생성
 */

import { existsSync, mkdirSync, writeFileSync, watch as fsWatch } from 'fs';
import { resolve, join } from 'path';
import { spawn } from 'child_process';
import { loadConfig, type ResolvedNswagConfig } from '../../config/index.js';
import { logger, Spinner, formatDuration, type ParsedArgs, colorize } from '../utils.js';

/**
 * generate 커맨드 실행
 */
export async function runGenerate(args: ParsedArgs): Promise<void> {
  const configPath = args.flags.config as string | undefined || args.flags.c as string | undefined;
  const watchMode = args.flags.watch === true || args.flags.w === true;

  logger.title('OpenAPI 스펙 생성');

  // 설정 로드
  const config = await loadConfig(configPath);
  logConfig(config);

  if (watchMode) {
    await runWatchMode(config);
  } else {
    await runOnce(config);
  }
}

/**
 * 설정 로그 출력
 */
function logConfig(config: ResolvedNswagConfig): void {
  logger.info(`테스트 프레임워크: ${colorize(config.testFramework, 'cyan')}`);
  logger.info(`테스트 패턴: ${config.testPatterns.join(', ')}`);
  logger.info(`Dry-run 모드: ${config.dryRun ? '활성화' : '비활성화'}`);
  logger.info(`출력: ${config.outputDir}/${config.outputFileName}.${config.outputFormat}`);
  logger.newline();
}

/**
 * 단일 실행
 */
async function runOnce(config: ResolvedNswagConfig): Promise<void> {
  const startTime = Date.now();
  const spinner = new Spinner('테스트 실행 중...');
  spinner.start();

  try {
    // 테스트 실행
    const testResult = await runTests(config);

    if (!testResult.success) {
      spinner.stop(false);
      logger.error('테스트 실패');
      if (testResult.output) {
        console.log(testResult.output);
      }
      process.exit(1);
    }

    spinner.update('스펙 파일 생성 중...');

    // 스펙 파일 생성
    if (!config.dryRun) {
      await generateSpecFile(config);
    }

    spinner.stop(true);

    const duration = Date.now() - startTime;
    logger.newline();
    logger.success(`완료! (${formatDuration(duration)})`);

    if (config.dryRun) {
      logger.warn('Dry-run 모드: 실제 스펙 파일이 생성되지 않았습니다.');
      logger.info('실제 생성하려면: NSWAG_DRY_RUN=0 npx nswag generate');
    }
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

/**
 * 감시 모드 실행
 */
async function runWatchMode(config: ResolvedNswagConfig): Promise<void> {
  logger.info('감시 모드 시작...');
  logger.info('변경 감지 시 자동으로 스펙이 재생성됩니다.');
  logger.info('종료하려면 Ctrl+C를 누르세요.');
  logger.newline();

  // 초기 실행
  await runOnce(config);

  // 파일 감시
  const watchPatterns = config.watch.patterns;
  const watchDirs = new Set<string>();

  // 감시할 디렉토리 추출
  for (const pattern of watchPatterns) {
    const parts = pattern.split('*');
    const firstPart = parts[0] ?? '';
    const baseDir = firstPart.replace(/\/$/, '') || '.';
    if (existsSync(baseDir)) {
      watchDirs.add(baseDir);
    }
  }

  // 디바운스 타이머
  let debounceTimer: NodeJS.Timeout | null = null;
  const debounceDelay = 500;

  // 각 디렉토리 감시
  for (const dir of watchDirs) {
    fsWatch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;

      // 무시할 파일 체크
      const shouldIgnore = config.watch.ignore.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filename);
      });

      if (shouldIgnore) return;

      // TypeScript 파일만 처리
      if (!filename.endsWith('.ts') && !filename.endsWith('.js')) return;

      // 디바운스 처리
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        logger.newline();
        logger.info(`파일 변경 감지: ${filename}`);
        try {
          await runOnce(config);
        } catch (error) {
          logger.error(`재생성 실패: ${error instanceof Error ? error.message : error}`);
        }
      }, debounceDelay);
    });

    logger.debug(`감시 중: ${dir}`);
  }

  // 프로세스 유지
  await new Promise(() => {});
}

/**
 * 테스트 실행
 */
async function runTests(config: ResolvedNswagConfig): Promise<{ success: boolean; output?: string }> {
  const { testFramework, testPatterns, testTimeout } = config;

  // 테스트 러너 명령어 결정
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
        // vitest는 include 옵션으로 패턴 지정
        args.push('--include', testPatterns.join(','));
      }
      break;

    case 'mocha':
      command = 'npx';
      args = ['mocha', '--timeout', String(testTimeout), ...testPatterns];
      break;

    default:
      throw new Error(`지원하지 않는 테스트 프레임워크: ${testFramework}`);
  }

  // ADDITIONAL_TEST_OPTS 환경 변수 처리
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
        // 스펙 수집 모드 활성화
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
 * 스펙 파일 생성
 */
async function generateSpecFile(config: ResolvedNswagConfig): Promise<void> {
  const { outputDir, outputFormat, outputFileName, openapi } = config;

  // 출력 디렉토리 생성
  const outputPath = resolve(process.cwd(), outputDir);
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  // 스펙 파일 경로
  const specFilePath = join(outputPath, `${outputFileName}.${outputFormat}`);

  // 수집된 스펙 데이터 로드 (임시 파일에서)
  const tempSpecPath = resolve(process.cwd(), '.nswag-temp-spec.json');
  let specData: Record<string, unknown> = {};

  if (existsSync(tempSpecPath)) {
    try {
      const { readFileSync, unlinkSync } = await import('fs');
      const content = readFileSync(tempSpecPath, 'utf-8');
      specData = JSON.parse(content);
      unlinkSync(tempSpecPath); // 임시 파일 삭제
    } catch {
      // 무시
    }
  }

  // OpenAPI 스펙 구조 생성
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

  // 포맷에 따라 저장
  if (outputFormat === 'yaml') {
    const { stringify } = await import('yaml');
    writeFileSync(specFilePath, stringify(spec), 'utf-8');
  } else {
    writeFileSync(specFilePath, JSON.stringify(spec, null, 2), 'utf-8');
  }

  logger.success(`스펙 파일 생성됨: ${specFilePath}`);
}

/**
 * 설정 모듈
 * nswag.config.ts 로더 및 설정 유틸리티
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
 * 기본 설정값
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
 * 설정 파일 이름 목록 (우선순위 순)
 */
const CONFIG_FILE_NAMES = [
  'nswag.config.ts',
  'nswag.config.js',
  'nswag.config.mjs',
  'nswag.config.cjs',
];

/**
 * 설정 객체 정의 헬퍼 함수
 * TypeScript 타입 지원을 위한 래퍼
 *
 * @param config - 사용자 설정
 * @returns 그대로 반환된 설정 객체
 *
 * @example
 * ```typescript
 * // nswag.config.ts
 * import { defineConfig } from '@aspect/nswag-specs';
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
 * 환경 변수에서 설정 읽기
 *
 * @returns 환경 변수 기반 설정
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const envConfig: EnvironmentConfig = {};

  // PATTERN 환경 변수
  const pattern = process.env.PATTERN;
  if (pattern) {
    envConfig.pattern = pattern;
  }

  // NSWAG_DRY_RUN 환경 변수
  const dryRunEnv = process.env.NSWAG_DRY_RUN;
  if (dryRunEnv !== undefined) {
    // "0" 또는 "false"면 비활성화, 그 외는 활성화
    envConfig.dryRun = dryRunEnv !== '0' && dryRunEnv.toLowerCase() !== 'false';
  }

  // ADDITIONAL_TEST_OPTS 환경 변수
  const additionalOpts = process.env.ADDITIONAL_TEST_OPTS;
  if (additionalOpts) {
    envConfig.additionalTestOpts = additionalOpts;
  }

  return envConfig;
}

/**
 * 설정 파일 경로 찾기
 *
 * @param cwd - 검색 시작 디렉토리
 * @returns 설정 파일 경로 또는 null
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
 * 설정 파일 로드
 *
 * @param configPath - 설정 파일 경로 (없으면 자동 탐색)
 * @returns 로드된 설정 또는 빈 객체
 */
export async function loadConfigFile(configPath?: string): Promise<NswagConfig> {
  const filePath = configPath || findConfigFile();

  if (!filePath) {
    return {};
  }

  try {
    // TypeScript 파일인 경우 ts-node 또는 tsx 로더가 필요할 수 있음
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);
    return module.default || module;
  } catch (error) {
    // .ts 파일을 직접 import할 수 없는 경우,
    // 컴파일된 .js 파일을 찾거나 에러 발생
    const jsPath = filePath.replace(/\.ts$/, '.js');
    if (existsSync(jsPath)) {
      try {
        const fileUrl = pathToFileURL(jsPath).href;
        const module = await import(fileUrl);
        return module.default || module;
      } catch {
        // 무시
      }
    }

    console.warn(`설정 파일 로드 실패: ${filePath}`);
    console.warn('기본 설정을 사용합니다.');
    return {};
  }
}

/**
 * 설정 해석 (resolve)
 * 사용자 설정, 환경 변수, 기본값을 병합
 *
 * @param userConfig - 사용자 설정
 * @param envConfig - 환경 변수 설정
 * @returns 해석된 완전한 설정
 */
export function resolveConfig(
  userConfig: NswagConfig,
  envConfig: EnvironmentConfig = {}
): ResolvedNswagConfig {
  // 환경 변수 우선 적용
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
 * 설정 로드 및 해석을 한 번에 수행
 *
 * @param configPath - 설정 파일 경로 (선택)
 * @returns 해석된 설정
 */
export async function loadConfig(configPath?: string): Promise<ResolvedNswagConfig> {
  const userConfig = await loadConfigFile(configPath);
  const envConfig = getEnvironmentConfig();
  return resolveConfig(userConfig, envConfig);
}

/**
 * 설정 검증
 *
 * @param config - 검증할 설정
 * @returns 검증 결과
 */
export function validateConfig(config: NswagConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 테스트 프레임워크 검증
  if (config.testFramework && !['jest', 'vitest', 'mocha'].includes(config.testFramework)) {
    errors.push(`유효하지 않은 testFramework: ${config.testFramework}`);
  }

  // 출력 포맷 검증
  if (config.outputFormat && !['json', 'yaml'].includes(config.outputFormat)) {
    errors.push(`유효하지 않은 outputFormat: ${config.outputFormat}`);
  }

  // 테스트 타임아웃 검증
  if (config.testTimeout !== undefined && config.testTimeout < 0) {
    errors.push(`testTimeout은 0 이상이어야 합니다: ${config.testTimeout}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

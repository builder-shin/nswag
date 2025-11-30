/**
 * Jest 통합 모듈
 * Jest 테스트 프레임워크와의 통합 기능 제공
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
 * Jest 설정 생성 헬퍼
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
 * Jest 테스트 환경 옵션 타입
 */
export interface JestTestEnvironmentOptions {
  /** VCR 모드: record, playback, none */
  vcrMode?: 'record' | 'playback' | 'none';
  /** 스펙 출력 경로 */
  outputSpec?: string;
  /** 응답 검증 활성화 */
  validateResponses?: boolean;
}

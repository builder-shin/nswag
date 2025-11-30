/**
 * Vitest 통합 모듈
 * Vitest 테스트 프레임워크와의 통합 기능 제공
 *
 * @example
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config';
 * import { nswagPlugin } from '@aspect/nswag-specs/vitest';
 *
 * export default defineConfig({
 *   plugins: [nswagPlugin()],
 *   test: {
 *     setupFiles: ['@aspect/nswag-specs/vitest/setup'],
 *   },
 * });
 */

export { nswagPlugin, type NswagPluginOptions } from './plugin.js';
export { setupVitest, getContext, teardown } from './setup.js';
export * from './setup.js';

/**
 * Vitest 설정 생성 헬퍼
 *
 * @example
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config';
 * import { createVitestConfig } from '@aspect/nswag-specs/vitest';
 *
 * const nswagConfig = createVitestConfig();
 * export default defineConfig({
 *   ...nswagConfig,
 * });
 */
export function createVitestConfig(options?: {
  setupFiles?: string[];
  vcrMode?: 'record' | 'playback' | 'none';
  outputSpec?: string;
}) {
  return {
    test: {
      setupFiles: [
        '@aspect/nswag-specs/vitest/setup',
        ...(options?.setupFiles ?? []),
      ],
      // 글로벌 설정
      globals: true,
    },
  };
}

/**
 * Vitest 테스트 환경 옵션 타입
 */
export interface VitestTestEnvironmentOptions {
  /** VCR 모드: record, playback, none */
  vcrMode?: 'record' | 'playback' | 'none';
  /** 스펙 출력 경로 */
  outputSpec?: string;
  /** 응답 검증 활성화 */
  validateResponses?: boolean;
}

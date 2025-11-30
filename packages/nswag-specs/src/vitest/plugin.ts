/**
 * Vitest 플러그인
 * 가상 모듈 주입, HMR 통합, 리포터 자동 등록
 */

import type { ConfigureOptions } from '../types/index.js';

/**
 * Vitest 플러그인 옵션
 */
export interface NswagPluginOptions {
  /** VCR 모드 */
  vcrMode?: 'record' | 'playback' | 'none';
  /** 스펙 출력 경로 */
  outputSpec?: string;
  /** 응답 검증 활성화 */
  validateResponses?: boolean;
  /** 글로벌 설정 */
  configure?: ConfigureOptions;
}

/**
 * Vite 플러그인 타입 (간소화)
 */
interface VitePlugin {
  name: string;
  enforce?: 'pre' | 'post';
  configResolved?: (config: unknown) => void;
  resolveId?: (id: string) => string | undefined;
  load?: (id: string) => string | undefined;
  configureServer?: (server: unknown) => void;
}

/**
 * nswag-specs Vitest 플러그인
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
export function nswagPlugin(options: NswagPluginOptions = {}): VitePlugin {
  const virtualModuleId = 'virtual:nswag-specs';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'nswag-specs',
    enforce: 'pre',

    /**
     * 설정 해결 후 처리
     */
    configResolved(_config: unknown) {
      // 플러그인 옵션 저장
      if (options.configure) {
        // 글로벌 설정은 setup 파일에서 처리
      }
    },

    /**
     * 가상 모듈 ID 해결
     */
    resolveId(id: string): string | undefined {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return undefined;
    },

    /**
     * 가상 모듈 로드
     */
    load(id: string): string | undefined {
      if (id === resolvedVirtualModuleId) {
        // 가상 모듈 내용 생성
        return generateVirtualModule(options);
      }
      return undefined;
    },

    /**
     * 개발 서버 설정 (HMR 통합)
     */
    configureServer(server: unknown) {
      // HMR 이벤트 처리
      const viteServer = server as {
        ws?: {
          on: (event: string, callback: (data: unknown) => void) => void;
        };
        moduleGraph?: {
          invalidateModule: (mod: unknown) => void;
          getModuleById: (id: string) => unknown;
        };
      };

      if (viteServer.ws) {
        viteServer.ws.on('nswag:reload', () => {
          // 모듈 캐시 무효화
          if (viteServer.moduleGraph) {
            const mod = viteServer.moduleGraph.getModuleById(resolvedVirtualModuleId);
            if (mod) {
              viteServer.moduleGraph.invalidateModule(mod);
            }
          }
        });
      }
    },
  };
}

/**
 * 가상 모듈 코드 생성
 */
function generateVirtualModule(options: NswagPluginOptions): string {
  return `
// 자동 생성된 nswag-specs 가상 모듈
export const nswagOptions = ${JSON.stringify(options, null, 2)};

export const vcrMode = "${options.vcrMode ?? 'none'}";
export const validateResponses = ${options.validateResponses ?? true};
export const outputSpec = ${options.outputSpec ? `"${options.outputSpec}"` : 'undefined'};

// 설정 가져오기
export { configure, getConfiguration } from '@aspect/nswag-specs/testing';
export { createHttpClient } from '@aspect/nswag-specs/testing';
export { getContextManager } from '@aspect/nswag-specs/testing';
export { getSpecCollector } from '@aspect/nswag-specs/testing';
`;
}

/**
 * 기본 export
 */
export default nswagPlugin;

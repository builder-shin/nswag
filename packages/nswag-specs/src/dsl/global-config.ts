/**
 * 전역 설정 관리자
 * Phase 4: API 버전 및 문서화 옵션
 *
 * openapiSpecs 다중 버전 설정 및 전역 옵션 관리
 */

import type { GlobalConfigOptions, OpenAPISpecInfo, OpenAPISpecsConfig } from './types.js';

/**
 * 전역 설정 저장소
 */
interface GlobalConfigStore {
  openapiRoot: string;
  openapiSpecs: OpenAPISpecsConfig;
  openapiNoAdditionalProperties: boolean;
  openapiAllPropertiesRequired: boolean;
  defaultOpenAPIVersion: '3.0.3' | '3.1.0';
}

/**
 * 기본 설정값
 */
const defaultConfig: GlobalConfigStore = {
  openapiRoot: './openapi',
  openapiSpecs: {},
  openapiNoAdditionalProperties: false,
  openapiAllPropertiesRequired: false,
  defaultOpenAPIVersion: '3.0.3',
};

/**
 * 현재 설정 저장소
 */
let currentConfig: GlobalConfigStore = { ...defaultConfig };

/**
 * 전역 설정 관리자 클래스
 */
export class GlobalConfigManager {
  /**
   * 전역 설정 구성
   *
   * @example
   * GlobalConfigManager.configure({
   *   openapiRoot: './openapi',
   *   openapiSpecs: {
   *     'v1/openapi.json': {
   *       openapi: '3.0.3',
   *       info: { title: 'API V1', version: 'v1' },
   *       servers: [{ url: 'https://api.example.com' }]
   *     },
   *     'v2/openapi.yaml': {
   *       openapi: '3.0.3',
   *       info: { title: 'API V2', version: 'v2' },
   *       servers: [{ url: 'https://api.example.com' }]
   *     }
   *   }
   * });
   */
  static configure(options: GlobalConfigOptions): void {
    currentConfig = {
      openapiRoot: options.openapiRoot ?? currentConfig.openapiRoot,
      openapiSpecs: options.openapiSpecs ?? currentConfig.openapiSpecs,
      openapiNoAdditionalProperties: options.openapiNoAdditionalProperties ?? currentConfig.openapiNoAdditionalProperties,
      openapiAllPropertiesRequired: options.openapiAllPropertiesRequired ?? currentConfig.openapiAllPropertiesRequired,
      defaultOpenAPIVersion: options.defaultOpenAPIVersion ?? currentConfig.defaultOpenAPIVersion,
    };
  }

  /**
   * 현재 설정 가져오기
   */
  static getConfig(): Readonly<GlobalConfigStore> {
    return { ...currentConfig };
  }

  /**
   * OpenAPI 루트 경로 가져오기
   */
  static getOpenapiRoot(): string {
    return currentConfig.openapiRoot;
  }

  /**
   * 특정 스펙 파일의 설정 가져오기
   */
  static getSpecConfig(specPath: string): Partial<OpenAPISpecInfo> | undefined {
    return currentConfig.openapiSpecs[specPath];
  }

  /**
   * 모든 스펙 파일 경로 가져오기
   */
  static getSpecPaths(): string[] {
    return Object.keys(currentConfig.openapiSpecs);
  }

  /**
   * 스펙 설정 존재 여부 확인
   */
  static hasSpec(specPath: string): boolean {
    return specPath in currentConfig.openapiSpecs;
  }

  /**
   * 스펙 설정 추가/업데이트
   */
  static setSpecConfig(specPath: string, config: Partial<OpenAPISpecInfo>): void {
    currentConfig.openapiSpecs[specPath] = config;
  }

  /**
   * 전역 noAdditionalProperties 옵션 가져오기
   */
  static getNoAdditionalProperties(): boolean {
    return currentConfig.openapiNoAdditionalProperties;
  }

  /**
   * 전역 allPropertiesRequired 옵션 가져오기
   */
  static getAllPropertiesRequired(): boolean {
    return currentConfig.openapiAllPropertiesRequired;
  }

  /**
   * 기본 OpenAPI 버전 가져오기
   */
  static getDefaultOpenAPIVersion(): '3.0.3' | '3.1.0' {
    return currentConfig.defaultOpenAPIVersion;
  }

  /**
   * 특정 스펙의 OpenAPI 버전 가져오기
   */
  static getOpenAPIVersion(specPath?: string): string {
    if (specPath && currentConfig.openapiSpecs[specPath]?.openapi) {
      return currentConfig.openapiSpecs[specPath].openapi!;
    }
    return currentConfig.defaultOpenAPIVersion;
  }

  /**
   * 설정 초기화
   */
  static reset(): void {
    currentConfig = { ...defaultConfig };
  }
}

// ============================================================================
// 편의 함수
// ============================================================================

/**
 * 전역 설정 구성 함수
 *
 * @example
 * configureOpenAPI({
 *   openapiRoot: './openapi',
 *   openapiSpecs: {
 *     'v1/openapi.json': {
 *       openapi: '3.0.3',
 *       info: { title: 'API V1', version: 'v1' }
 *     }
 *   },
 *   openapiNoAdditionalProperties: true,
 *   openapiAllPropertiesRequired: true
 * });
 */
export function configureOpenAPI(options: GlobalConfigOptions): void {
  GlobalConfigManager.configure(options);
}

/**
 * 현재 전역 설정 가져오기
 */
export function getGlobalConfig(): Readonly<GlobalConfigStore> {
  return GlobalConfigManager.getConfig();
}

/**
 * 전역 설정 초기화
 */
export function resetGlobalConfig(): void {
  GlobalConfigManager.reset();
}

/**
 * 특정 스펙의 설정 가져오기
 */
export function getSpecConfig(specPath: string): Partial<OpenAPISpecInfo> | undefined {
  return GlobalConfigManager.getSpecConfig(specPath);
}

/**
 * OpenAPI 버전 가져오기
 */
export function getOpenAPIVersion(specPath?: string): string {
  return GlobalConfigManager.getOpenAPIVersion(specPath);
}

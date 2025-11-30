/**
 * OpenAPI 스펙 로더
 * openapiRoot 디렉토리 기반으로 OpenAPI 파일을 로드하고 캐싱 처리
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import type { OpenAPIObject, CacheEntry, CacheConfig, FileInfo } from './types.js';

/**
 * 스펙 캐시 저장소
 */
const cache = new Map<string, CacheEntry>();

/**
 * 기본 캐시 설정
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 60000, // 1분
};

/**
 * 파일 경로에서 포맷 추출
 * @param filePath - 파일 경로
 * @returns 파일 포맷 ('json' | 'yaml')
 */
export function getFileFormat(filePath: string): 'json' | 'yaml' {
  const ext = extname(filePath).toLowerCase();
  return ext === '.yaml' || ext === '.yml' ? 'yaml' : 'json';
}

/**
 * URL 경로에서 요청된 파일 정보 파싱
 * @param requestPath - 요청 URL 경로 (예: /v1/openapi.json)
 * @param openapiRoot - OpenAPI 파일 루트 디렉토리
 * @returns 파일 정보 또는 null
 */
export function parseRequestPath(
  requestPath: string,
  openapiRoot: string
): FileInfo | null {
  // 경로 정규화 (앞뒤 슬래시 제거)
  const normalizedPath = requestPath.replace(/^\/+|\/+$/g, '');

  if (!normalizedPath) {
    return null;
  }

  // 파일 확장자 확인
  const ext = extname(normalizedPath).toLowerCase();
  if (ext !== '.json' && ext !== '.yaml' && ext !== '.yml') {
    return null;
  }

  const absolutePath = resolve(openapiRoot, normalizedPath);
  const format = getFileFormat(normalizedPath);

  // 버전 추출 시도 (예: v1/openapi.json -> v1)
  const pathParts = normalizedPath.split('/');
  const firstPart = pathParts[0];
  const version = pathParts.length > 1 && firstPart && /^v\d+/.test(firstPart)
    ? firstPart
    : undefined;

  return {
    absolutePath,
    relativePath: normalizedPath,
    format,
    version,
  };
}

/**
 * OpenAPI 파일 로드
 * @param filePath - 파일 절대 경로
 * @param cacheConfig - 캐시 설정
 * @returns OpenAPI 객체 또는 null (파일 없음)
 */
export function loadOpenAPIFile(
  filePath: string,
  cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG
): OpenAPIObject | null {
  // 캐시 확인
  if (cacheConfig.enabled) {
    const cached = cache.get(filePath);
    if (cached && Date.now() - cached.timestamp < cacheConfig.ttl) {
      return cached.content;
    }
  }

  // 파일 존재 확인
  if (!existsSync(filePath)) {
    return null;
  }

  // 파일인지 확인
  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const format = getFileFormat(filePath);

    let spec: OpenAPIObject;
    if (format === 'yaml') {
      spec = parseYAML(content) as OpenAPIObject;
    } else {
      spec = JSON.parse(content) as OpenAPIObject;
    }

    // 캐시 저장
    if (cacheConfig.enabled) {
      cache.set(filePath, {
        content: spec,
        timestamp: Date.now(),
        format,
      });
    }

    return spec;
  } catch {
    return null;
  }
}

/**
 * OpenAPI 객체를 지정된 포맷으로 직렬화
 * @param spec - OpenAPI 객체
 * @param format - 출력 포맷
 * @returns 직렬화된 문자열
 */
export function serializeOpenAPI(
  spec: OpenAPIObject,
  format: 'json' | 'yaml'
): string {
  if (format === 'yaml') {
    return stringifyYAML(spec, { indent: 2 });
  }
  return JSON.stringify(spec, null, 2);
}

/**
 * 포맷에 따른 Content-Type 반환
 * @param format - 파일 포맷
 * @returns Content-Type 문자열
 */
export function getContentType(format: 'json' | 'yaml'): string {
  return format === 'yaml' ? 'text/yaml; charset=utf-8' : 'application/json; charset=utf-8';
}

/**
 * OpenAPI 객체 깊은 복사
 * @param spec - 원본 OpenAPI 객체
 * @returns 복사된 객체
 */
export function cloneOpenAPI(spec: OpenAPIObject): OpenAPIObject {
  return JSON.parse(JSON.stringify(spec));
}

/**
 * 특정 경로의 캐시 무효화
 * @param filePath - 무효화할 파일 경로 (없으면 전체 무효화)
 */
export function invalidateCache(filePath?: string): void {
  if (filePath) {
    cache.delete(filePath);
  } else {
    cache.clear();
  }
}

/**
 * 캐시 통계 조회
 * @returns 캐시 엔트리 수
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

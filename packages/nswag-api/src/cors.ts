/**
 * CORS 핸들러
 * Cross-Origin Resource Sharing 처리
 */

import type { CorsConfig } from './types.js';

/**
 * CORS 응답 헤더 타입
 */
export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Max-Age'?: string;
  'Access-Control-Allow-Credentials'?: string;
  'Vary': string;
}

/**
 * CORS preflight 요청인지 확인
 * @param method - HTTP 메서드
 * @returns preflight 요청 여부
 */
export function isPreflightRequest(method: string): boolean {
  return method.toUpperCase() === 'OPTIONS';
}

/**
 * 요청 오리진이 허용된 목록에 있는지 확인
 * @param origin - 요청 오리진
 * @param allowedOrigins - 허용된 오리진 목록
 * @returns 허용 여부
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!origin) {
    return false;
  }

  // 모든 오리진 허용 (*)
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // 정확히 일치하는지 확인
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // 와일드카드 패턴 확인 (예: *.example.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      if (origin.endsWith(domain)) {
        // 서브도메인 확인 (예: sub.example.com)
        const subdomain = origin.slice(0, -domain.length);
        if (subdomain.endsWith('.') || subdomain === '') {
          continue;
        }
        // https://sub.example.com -> 프로토콜 + 서브도메인
        const match = origin.match(new RegExp(`^(https?://)?[^/]+\\.${escapeRegExp(domain)}$`));
        if (match) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 정규식 특수문자 이스케이프
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * CORS 헤더 생성
 * @param origin - 요청 오리진
 * @param corsConfig - CORS 설정
 * @returns CORS 헤더 객체 또는 null (CORS 비활성화 또는 허용되지 않은 오리진)
 */
export function getCorsHeaders(
  origin: string | undefined,
  corsConfig: CorsConfig
): Partial<CorsHeaders> | null {
  // CORS가 비활성화된 경우
  if (!corsConfig.enabled) {
    return null;
  }

  // 오리진이 없거나 허용되지 않은 경우
  if (!isOriginAllowed(origin, corsConfig.origins)) {
    return null;
  }

  const allowedOrigin = corsConfig.origins.includes('*') ? '*' : origin!;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400', // 24시간
    'Vary': 'Origin',
  };
}

/**
 * preflight 요청에 대한 응답 헤더 생성
 * @param origin - 요청 오리진
 * @param corsConfig - CORS 설정
 * @returns preflight 응답 헤더 또는 null
 */
export function getPreflightHeaders(
  origin: string | undefined,
  corsConfig: CorsConfig
): Partial<CorsHeaders> | null {
  const headers = getCorsHeaders(origin, corsConfig);
  if (!headers) {
    return null;
  }

  return {
    ...headers,
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 헤더에서 오리진 추출
 * @param headers - 요청 헤더
 * @returns 오리진 문자열 또는 undefined
 */
export function getOriginFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const origin = headers['origin'] || headers['Origin'];
  if (typeof origin === 'string') {
    return origin;
  }
  if (Array.isArray(origin)) {
    return origin[0];
  }
  return undefined;
}

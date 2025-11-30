/**
 * 인증 핸들러
 * Basic, Bearer, API-Key 인증 지원
 */

import type { AuthConfig } from './types.js';

/**
 * 인증 결과 타입
 */
export interface AuthResult {
  /** 인증 성공 여부 */
  success: boolean;
  /** 실패 시 에러 메시지 */
  error?: string;
  /** WWW-Authenticate 헤더 값 */
  wwwAuthenticate?: string;
}

/**
 * Basic 인증 자격 증명 파싱
 * @param authHeader - Authorization 헤더 값
 * @returns { username, password } 또는 null
 */
function parseBasicAuth(authHeader: string): { username: string; password: string } | null {
  const match = authHeader.match(/^Basic\s+(.+)$/i);
  if (!match || !match[1]) {
    return null;
  }

  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Bearer 토큰 파싱
 * @param authHeader - Authorization 헤더 값
 * @returns 토큰 문자열 또는 null
 */
function parseBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match && match[1] ? match[1] : null;
}

/**
 * 요청 헤더에서 인증 정보 검증
 * @param headers - 요청 헤더
 * @param authConfig - 인증 설정
 * @returns 인증 결과
 */
export function validateAuth(
  headers: Record<string, string | string[] | undefined>,
  authConfig: AuthConfig
): AuthResult {
  // 인증이 비활성화된 경우
  if (!authConfig.enabled) {
    return { success: true };
  }

  const { type, credentials } = authConfig;

  switch (type) {
    case 'basic': {
      const authHeader = getHeader(headers, 'authorization');
      if (!authHeader) {
        return {
          success: false,
          error: 'Authorization header required',
          wwwAuthenticate: 'Basic realm="OpenAPI Documentation"',
        };
      }

      const parsed = parseBasicAuth(authHeader);
      if (!parsed) {
        return {
          success: false,
          error: 'Invalid Basic auth format',
          wwwAuthenticate: 'Basic realm="OpenAPI Documentation"',
        };
      }

      if (
        parsed.username !== credentials.username ||
        parsed.password !== credentials.password
      ) {
        return {
          success: false,
          error: 'Invalid credentials',
          wwwAuthenticate: 'Basic realm="OpenAPI Documentation"',
        };
      }

      return { success: true };
    }

    case 'bearer': {
      const authHeader = getHeader(headers, 'authorization');
      if (!authHeader) {
        return {
          success: false,
          error: 'Authorization header required',
          wwwAuthenticate: 'Bearer realm="OpenAPI Documentation"',
        };
      }

      const token = parseBearerToken(authHeader);
      if (!token) {
        return {
          success: false,
          error: 'Invalid Bearer token format',
          wwwAuthenticate: 'Bearer realm="OpenAPI Documentation"',
        };
      }

      if (token !== credentials.token) {
        return {
          success: false,
          error: 'Invalid token',
          wwwAuthenticate: 'Bearer realm="OpenAPI Documentation", error="invalid_token"',
        };
      }

      return { success: true };
    }

    case 'api-key': {
      const headerName = credentials.headerName || 'X-API-Key';
      const apiKey = getHeader(headers, headerName.toLowerCase());

      if (!apiKey) {
        return {
          success: false,
          error: `${headerName} header required`,
        };
      }

      if (apiKey !== credentials.apiKey) {
        return {
          success: false,
          error: 'Invalid API key',
        };
      }

      return { success: true };
    }

    default:
      return {
        success: false,
        error: `Unknown auth type: ${type}`,
      };
  }
}

/**
 * 헤더에서 값 추출 (대소문자 무시)
 * @param headers - 요청 헤더
 * @param name - 헤더 이름 (소문자)
 * @returns 헤더 값 또는 undefined
 */
function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  // 직접 접근 시도
  const direct = headers[name];
  if (typeof direct === 'string') {
    return direct;
  }
  if (Array.isArray(direct)) {
    return direct[0];
  }

  // 대소문자 무시 검색
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value)) {
        return value[0];
      }
    }
  }

  return undefined;
}

/**
 * 인증 실패 응답 생성을 위한 상태 코드 결정
 * @param authConfig - 인증 설정
 * @returns HTTP 상태 코드 (401 또는 403)
 */
export function getAuthErrorStatusCode(authConfig: AuthConfig): number {
  // Basic, Bearer는 401, API-Key는 403
  return authConfig.type === 'api-key' ? 403 : 401;
}

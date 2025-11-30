/**
 * URL 인코딩 유틸리티
 * HTML Safe 입력 처리 및 쿼리 파라미터 자동 인코딩
 */

/**
 * 쿼리 파라미터 값을 URL 인코딩
 * 날짜/시간 등의 특수 문자를 안전하게 인코딩
 *
 * @param value - 인코딩할 값
 * @returns URL 인코딩된 문자열
 */
export function encodeQueryValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  return encodeURIComponent(stringValue);
}

/**
 * 쿼리 파라미터 객체를 URL 쿼리 문자열로 변환
 *
 * @param params - 쿼리 파라미터 객체
 * @returns URL 쿼리 문자열 (? 포함)
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== null && value !== undefined
  );

  if (entries.length === 0) {
    return '';
  }

  const queryParts = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      // 배열인 경우 여러 개의 같은 키로 처리
      return value
        .map((v) => `${encodeURIComponent(key)}=${encodeQueryValue(v)}`)
        .join('&');
    }
    return `${encodeURIComponent(key)}=${encodeQueryValue(value)}`;
  });

  return `?${queryParts.join('&')}`;
}

/**
 * URL 경로와 쿼리 파라미터를 조합하여 완전한 URL 생성
 *
 * @param basePath - 기본 경로
 * @param pathParams - 경로 파라미터 (e.g., { id: 123 })
 * @param queryParams - 쿼리 파라미터
 * @returns 완성된 URL 문자열
 */
export function buildUrl(
  basePath: string,
  pathParams?: Record<string, unknown>,
  queryParams?: Record<string, unknown>
): string {
  let url = basePath;

  // 경로 파라미터 치환 (e.g., /users/{id} -> /users/123)
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      const encodedValue = encodeURIComponent(String(value));
      url = url.replace(`{${key}}`, encodedValue);
      url = url.replace(`:${key}`, encodedValue);
    }
  }

  // 쿼리 파라미터 추가
  if (queryParams && Object.keys(queryParams).length > 0) {
    url += buildQueryString(queryParams);
  }

  return url;
}

/**
 * ISO 날짜/시간 문자열을 URL 안전하게 인코딩
 * 콜론(:)을 %3A로 변환
 *
 * @param dateTime - ISO 8601 형식의 날짜/시간 문자열
 * @returns URL 인코딩된 날짜/시간 문자열
 */
export function encodeDateTime(dateTime: string | Date): string {
  const isoString = dateTime instanceof Date ? dateTime.toISOString() : dateTime;
  return encodeURIComponent(isoString);
}

/**
 * HTML 특수 문자를 이스케이프 처리
 * XSS 방지를 위한 HTML 엔티티 변환
 *
 * @param str - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * URL 디코딩 (인코딩된 값을 원래 값으로 복원)
 *
 * @param encodedValue - URL 인코딩된 문자열
 * @returns 디코딩된 문자열
 */
export function decodeQueryValue(encodedValue: string): string {
  try {
    return decodeURIComponent(encodedValue);
  } catch {
    // 잘못된 인코딩인 경우 원본 반환
    return encodedValue;
  }
}

/**
 * 쿼리 문자열을 파싱하여 객체로 변환
 *
 * @param queryString - 쿼리 문자열 (? 포함 또는 미포함)
 * @returns 파싱된 파라미터 객체
 */
export function parseQueryString(queryString: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const query = queryString.startsWith('?') ? queryString.slice(1) : queryString;

  if (!query) {
    return result;
  }

  const pairs = query.split('&');
  for (const pair of pairs) {
    const parts = pair.split('=');
    const key = decodeQueryValue(parts[0] || '');
    const value = decodeQueryValue(parts[1] || '');
    if (key) {
      const existing = result[key];
      if (existing !== undefined) {
        // 이미 존재하는 키의 경우 배열로 변환
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[key] = [existing, value];
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * 경로 파라미터 추출
 * /users/{id}/posts/{postId} 형식에서 파라미터 이름 추출
 *
 * @param pathTemplate - 경로 템플릿
 * @returns 파라미터 이름 배열
 */
export function extractPathParams(pathTemplate: string): string[] {
  const params: string[] = [];
  const regex = /\{([^}]+)\}|:([^/]+)/g;
  let match;

  while ((match = regex.exec(pathTemplate)) !== null) {
    const paramName = match[1] ?? match[2];
    if (paramName) {
      params.push(paramName);
    }
  }

  return params;
}

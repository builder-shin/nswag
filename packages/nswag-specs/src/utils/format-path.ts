/**
 * 경로 포맷팅 유틸리티
 */

/**
 * API 경로를 OpenAPI 형식으로 변환
 * Express 스타일(:id)을 OpenAPI 스타일({id})로 변환
 *
 * @param path - 변환할 경로
 * @returns OpenAPI 형식의 경로
 */
export function formatPath(path: string): string {
  // :param 형식을 {param} 형식으로 변환
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

/**
 * 경로에서 파라미터 추출
 *
 * @param path - 분석할 경로
 * @returns 파라미터 이름 배열
 */
export function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      params.push(match[1]);
    }
  }

  return params;
}

/**
 * 기본 경로와 하위 경로를 결합
 *
 * @param basePath - 기본 경로
 * @param subPath - 하위 경로
 * @returns 결합된 경로
 */
export function joinPaths(basePath: string, subPath: string): string {
  const normalizedBase = basePath.replace(/\/+$/, '');
  const normalizedSub = subPath.replace(/^\/+/, '');

  if (!normalizedSub) return normalizedBase || '/';
  if (!normalizedBase) return `/${normalizedSub}`;

  return `${normalizedBase}/${normalizedSub}`;
}

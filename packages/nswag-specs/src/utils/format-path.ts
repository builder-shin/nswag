/**
 * Path Formatting Utility
 */

/**
 * Convert API path to OpenAPI format
 * Convert Express style (:id) to OpenAPI style ({id})
 *
 * @param path - Path to convert
 * @returns Path in OpenAPI format
 */
export function formatPath(path: string): string {
  // Convert :param format to {param} format
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

/**
 * Extract parameters from path
 *
 * @param path - Path to analyze
 * @returns Array of parameter names
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
 * Combine base path and sub path
 *
 * @param basePath - Base path
 * @param subPath - Sub path
 * @returns Combined path
 */
export function joinPaths(basePath: string, subPath: string): string {
  const normalizedBase = basePath.replace(/\/+$/, '');
  const normalizedSub = subPath.replace(/^\/+/, '');

  if (!normalizedSub) return normalizedBase || '/';
  if (!normalizedBase) return `/${normalizedSub}`;

  return `${normalizedBase}/${normalizedSub}`;
}

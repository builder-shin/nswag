/**
 * OpenAPI spec loader
 * Loads and caches OpenAPI files based on openapiRoot directory
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import type { OpenAPIObject, CacheEntry, CacheConfig, FileInfo } from './types.js';

/**
 * Spec cache storage
 */
const cache = new Map<string, CacheEntry>();

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 60000, // 1 minute
};

/**
 * Extract format from file path
 * @param filePath - File path
 * @returns File format ('json' | 'yaml')
 */
export function getFileFormat(filePath: string): 'json' | 'yaml' {
  const ext = extname(filePath).toLowerCase();
  return ext === '.yaml' || ext === '.yml' ? 'yaml' : 'json';
}

/**
 * Parse file information from URL path
 * @param requestPath - Request URL path (e.g., /v1/openapi.json)
 * @param openapiRoot - OpenAPI file root directory
 * @returns File information or null
 */
export function parseRequestPath(
  requestPath: string,
  openapiRoot: string
): FileInfo | null {
  // Normalize path (remove leading/trailing slashes)
  const normalizedPath = requestPath.replace(/^\/+|\/+$/g, '');

  if (!normalizedPath) {
    return null;
  }

  // Check file extension
  const ext = extname(normalizedPath).toLowerCase();
  if (ext !== '.json' && ext !== '.yaml' && ext !== '.yml') {
    return null;
  }

  const absolutePath = resolve(openapiRoot, normalizedPath);
  const format = getFileFormat(normalizedPath);

  // Attempt to extract version (e.g., v1/openapi.json -> v1)
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
 * Load OpenAPI file
 * @param filePath - Absolute file path
 * @param cacheConfig - Cache configuration
 * @returns OpenAPI object or null (file not found)
 */
export function loadOpenAPIFile(
  filePath: string,
  cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG
): OpenAPIObject | null {
  // Check cache
  if (cacheConfig.enabled) {
    const cached = cache.get(filePath);
    if (cached && Date.now() - cached.timestamp < cacheConfig.ttl) {
      return cached.content;
    }
  }

  // Check file exists
  if (!existsSync(filePath)) {
    return null;
  }

  // Check if it's a file
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

    // Store in cache
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
 * Serialize OpenAPI object to specified format
 * @param spec - OpenAPI object
 * @param format - Output format
 * @returns Serialized string
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
 * Return Content-Type based on format
 * @param format - File format
 * @returns Content-Type string
 */
export function getContentType(format: 'json' | 'yaml'): string {
  return format === 'yaml' ? 'text/yaml; charset=utf-8' : 'application/json; charset=utf-8';
}

/**
 * Deep copy OpenAPI object
 * @param spec - Original OpenAPI object
 * @returns Copied object
 */
export function cloneOpenAPI(spec: OpenAPIObject): OpenAPIObject {
  return JSON.parse(JSON.stringify(spec));
}

/**
 * Invalidate cache for specific path
 * @param filePath - File path to invalidate (if omitted, clear all)
 */
export function invalidateCache(filePath?: string): void {
  if (filePath) {
    cache.delete(filePath);
  } else {
    cache.clear();
  }
}

/**
 * Query cache statistics
 * @returns Number of cache entries
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

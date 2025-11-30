/**
 * URL Encoding Utilities
 * HTML-safe input handling and automatic query parameter encoding
 */

/**
 * URL encode query parameter value
 * Safely encode special characters like date/time
 *
 * @param value - Value to encode
 * @returns URL-encoded string
 */
export function encodeQueryValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  return encodeURIComponent(stringValue);
}

/**
 * Convert query parameter object to URL query string
 *
 * @param params - Query parameter object
 * @returns URL query string (including ?)
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
      // For arrays, use multiple instances of the same key
      return value
        .map((v) => `${encodeURIComponent(key)}=${encodeQueryValue(v)}`)
        .join('&');
    }
    return `${encodeURIComponent(key)}=${encodeQueryValue(value)}`;
  });

  return `?${queryParts.join('&')}`;
}

/**
 * Build complete URL by combining base path and query parameters
 *
 * @param basePath - Base path
 * @param pathParams - Path parameters (e.g., { id: 123 })
 * @param queryParams - Query parameters
 * @returns Complete URL string
 */
export function buildUrl(
  basePath: string,
  pathParams?: Record<string, unknown>,
  queryParams?: Record<string, unknown>
): string {
  let url = basePath;

  // Replace path parameters (e.g., /users/{id} -> /users/123)
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      const encodedValue = encodeURIComponent(String(value));
      url = url.replace(`{${key}}`, encodedValue);
      url = url.replace(`:${key}`, encodedValue);
    }
  }

  // Add query parameters
  if (queryParams && Object.keys(queryParams).length > 0) {
    url += buildQueryString(queryParams);
  }

  return url;
}

/**
 * URL-safe encoding of ISO date/time string
 * Convert colons (:) to %3A
 *
 * @param dateTime - Date/time string in ISO 8601 format
 * @returns URL-encoded date/time string
 */
export function encodeDateTime(dateTime: string | Date): string {
  const isoString = dateTime instanceof Date ? dateTime.toISOString() : dateTime;
  return encodeURIComponent(isoString);
}

/**
 * Escape HTML special characters
 * Convert to HTML entities to prevent XSS
 *
 * @param str - String to escape
 * @returns Escaped string
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
 * URL decode (restore encoded value to original)
 *
 * @param encodedValue - URL-encoded string
 * @returns Decoded string
 */
export function decodeQueryValue(encodedValue: string): string {
  try {
    return decodeURIComponent(encodedValue);
  } catch {
    // Return original if invalid encoding
    return encodedValue;
  }
}

/**
 * Parse query string to object
 *
 * @param queryString - Query string (with or without ?)
 * @returns Parsed parameter object
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
        // Convert to array if key already exists
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
 * Extract path parameters
 * Extract parameter names from /users/{id}/posts/{postId} format
 *
 * @param pathTemplate - Path template
 * @returns Array of parameter names
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

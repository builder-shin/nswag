/**
 * Utility Module
 * Common utility functions
 */

export { deepMerge, deepMergeAll } from './deep-merge.js';
export type { ArrayMergeStrategy, DeepMergeOptions } from './deep-merge.js';
export { formatPath } from './format-path.js';

// URL encoding utilities
export {
  encodeQueryValue,
  buildQueryString,
  buildUrl,
  encodeDateTime,
  escapeHtml,
  decodeQueryValue,
  parseQueryString,
  extractPathParams,
} from './url-encoding.js';

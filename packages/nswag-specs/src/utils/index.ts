/**
 * 유틸리티 모듈
 * 공통 유틸리티 함수들
 */

export { deepMerge, deepMergeAll } from './deep-merge.js';
export type { ArrayMergeStrategy, DeepMergeOptions } from './deep-merge.js';
export { formatPath } from './format-path.js';

// URL 인코딩 유틸리티
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

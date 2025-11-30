/**
 * @aspect/eslint-plugin-nswag
 * ESLint plugin for @aspect/nswag-specs DSL
 */

import requireRunTest from './rules/require-run-test.js';
import validSchema from './rules/valid-schema.js';
import noDuplicateOperationId from './rules/no-duplicate-operation-id.js';
import requireResponseSchema from './rules/require-response-schema.js';
import requireTags from './rules/require-tags.js';
import noEmptyResponse from './rules/no-empty-response.js';
import validHttpStatus from './rules/valid-http-status.js';
import preferRequestBody from './rules/prefer-request-body.js';

// 모든 규칙
const rules = {
  'require-run-test': requireRunTest,
  'valid-schema': validSchema,
  'no-duplicate-operation-id': noDuplicateOperationId,
  'require-response-schema': requireResponseSchema,
  'require-tags': requireTags,
  'no-empty-response': noEmptyResponse,
  'valid-http-status': validHttpStatus,
  'prefer-request-body': preferRequestBody,
};

// 권장 설정
const recommendedConfig = {
  plugins: ['@aspect/nswag'],
  rules: {
    '@aspect/nswag/require-run-test': 'error',
    '@aspect/nswag/valid-schema': 'error',
    '@aspect/nswag/no-duplicate-operation-id': 'error',
    '@aspect/nswag/require-response-schema': 'warn',
    '@aspect/nswag/require-tags': 'warn',
    '@aspect/nswag/no-empty-response': 'error',
    '@aspect/nswag/valid-http-status': 'error',
    '@aspect/nswag/prefer-request-body': 'warn',
  },
};

// 엄격한 설정
const strictConfig = {
  plugins: ['@aspect/nswag'],
  rules: {
    '@aspect/nswag/require-run-test': 'error',
    '@aspect/nswag/valid-schema': 'error',
    '@aspect/nswag/no-duplicate-operation-id': 'error',
    '@aspect/nswag/require-response-schema': 'error',
    '@aspect/nswag/require-tags': 'error',
    '@aspect/nswag/no-empty-response': 'error',
    '@aspect/nswag/valid-http-status': ['error', { warnOnNonStandard: true }],
    '@aspect/nswag/prefer-request-body': 'error',
  },
};

// 플러그인 내보내기
const plugin = {
  rules,
  configs: {
    recommended: recommendedConfig,
    strict: strictConfig,
  },
};

export default plugin;
export { rules };

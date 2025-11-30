/**
 * @builder-shin/eslint-plugin-nswag
 * ESLint plugin for @builder-shin/nswag-specs DSL
 */

import requireRunTest from './rules/require-run-test.js';
import validSchema from './rules/valid-schema.js';
import noDuplicateOperationId from './rules/no-duplicate-operation-id.js';
import requireResponseSchema from './rules/require-response-schema.js';
import requireTags from './rules/require-tags.js';
import noEmptyResponse from './rules/no-empty-response.js';
import validHttpStatus from './rules/valid-http-status.js';
import preferRequestBody from './rules/prefer-request-body.js';

// All rules
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

// Recommended config
const recommendedConfig = {
  plugins: ['@builder-shin/nswag'],
  rules: {
    '@builder-shin/nswag/require-run-test': 'error',
    '@builder-shin/nswag/valid-schema': 'error',
    '@builder-shin/nswag/no-duplicate-operation-id': 'error',
    '@builder-shin/nswag/require-response-schema': 'warn',
    '@builder-shin/nswag/require-tags': 'warn',
    '@builder-shin/nswag/no-empty-response': 'error',
    '@builder-shin/nswag/valid-http-status': 'error',
    '@builder-shin/nswag/prefer-request-body': 'warn',
  },
};

// Strict config
const strictConfig = {
  plugins: ['@builder-shin/nswag'],
  rules: {
    '@builder-shin/nswag/require-run-test': 'error',
    '@builder-shin/nswag/valid-schema': 'error',
    '@builder-shin/nswag/no-duplicate-operation-id': 'error',
    '@builder-shin/nswag/require-response-schema': 'error',
    '@builder-shin/nswag/require-tags': 'error',
    '@builder-shin/nswag/no-empty-response': 'error',
    '@builder-shin/nswag/valid-http-status': ['error', { warnOnNonStandard: true }],
    '@builder-shin/nswag/prefer-request-body': 'error',
  },
};

// Plugin export
const plugin = {
  rules,
  configs: {
    recommended: recommendedConfig,
    strict: strictConfig,
  },
};

export default plugin;
export { rules };

/**
 * valid-http-status rule
 * Only allow valid HTTP status codes (100-599)
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';

// Check if node is a response() call
function isResponseCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'response'
  );
}

// Extract literal numeric value
function getNumericValue(node: Node): number | undefined {
  if (node.type === 'Literal' && typeof node.value === 'number') {
    return node.value;
  }
  // Also allow string numbers
  if (node.type === 'Literal' && typeof node.value === 'string') {
    const parsed = parseInt(node.value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

// Validate HTTP status code
function isValidHttpStatusCode(code: number): boolean {
  return Number.isInteger(code) && code >= 100 && code <= 599;
}

// Standard HTTP status codes list
const STANDARD_STATUS_CODES = new Set([
  // 1xx Informational
  100, 101, 102, 103,
  // 2xx Success
  200, 201, 202, 203, 204, 205, 206, 207, 208, 226,
  // 3xx Redirection
  300, 301, 302, 303, 304, 305, 307, 308,
  // 4xx Client Error
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409,
  410, 411, 412, 413, 414, 415, 416, 417, 418, 421,
  422, 423, 424, 425, 426, 428, 429, 431, 451,
  // 5xx Server Error
  500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511,
]);

function isStandardStatusCode(code: number): boolean {
  return STANDARD_STATUS_CODES.has(code);
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Only allow valid HTTP status codes (100-599)',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          warnOnNonStandard: {
            type: 'boolean',
            default: false,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidStatusCode:
        'Invalid HTTP status code: {{code}}. Status code must be in range 100-599.',
      nonStandardStatusCode:
        'Non-standard HTTP status code: {{code}}. Using RFC-defined standard status codes is recommended.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const warnOnNonStandard = options.warnOnNonStandard ?? false;

    return {
      CallExpression(node) {
        if (!isResponseCall(node)) {
          return;
        }

        // First argument of response() is the status code
        const statusCodeArg = node.arguments[0];
        if (!statusCodeArg) {
          return;
        }

        const statusCode = getNumericValue(statusCodeArg);
        if (statusCode === undefined) {
          return; // Don't check dynamic values
        }

        if (!isValidHttpStatusCode(statusCode)) {
          context.report({
            node: statusCodeArg,
            messageId: 'invalidStatusCode',
            data: { code: String(statusCode) },
          });
          return;
        }

        if (warnOnNonStandard && !isStandardStatusCode(statusCode)) {
          context.report({
            node: statusCodeArg,
            messageId: 'nonStandardStatusCode',
            data: { code: String(statusCode) },
          });
        }
      },
    };
  },
};

export default rule;

/**
 * valid-http-status 규칙
 * 유효한 HTTP 상태 코드만 사용 (100-599)
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';

// 노드가 response() 호출인지 확인
function isResponseCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'response'
  );
}

// 리터럴 숫자 값 추출
function getNumericValue(node: Node): number | undefined {
  if (node.type === 'Literal' && typeof node.value === 'number') {
    return node.value;
  }
  // 문자열로 된 숫자도 허용
  if (node.type === 'Literal' && typeof node.value === 'string') {
    const parsed = parseInt(node.value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

// HTTP 상태 코드 유효성 검사
function isValidHttpStatusCode(code: number): boolean {
  return Number.isInteger(code) && code >= 100 && code <= 599;
}

// 표준 HTTP 상태 코드 목록
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
      description: '유효한 HTTP 상태 코드만 사용 (100-599)',
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
        '유효하지 않은 HTTP 상태 코드: {{code}}. 상태 코드는 100-599 범위여야 합니다.',
      nonStandardStatusCode:
        '표준이 아닌 HTTP 상태 코드: {{code}}. RFC에 정의된 표준 상태 코드 사용을 권장합니다.',
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

        // response()의 첫 번째 인자가 상태 코드
        const statusCodeArg = node.arguments[0];
        if (!statusCodeArg) {
          return;
        }

        const statusCode = getNumericValue(statusCodeArg);
        if (statusCode === undefined) {
          return; // 동적 값은 검사하지 않음
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

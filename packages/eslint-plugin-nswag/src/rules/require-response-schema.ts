/**
 * require-response-schema 규칙
 * response() 블록 내 schema() 정의 권장
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

// 노드가 schema() 호출인지 확인
function isSchemaCall(node: CallExpression): boolean {
  return (
    node.callee.type === 'Identifier' &&
    node.callee.name === 'schema'
  );
}

// response 블록 내에서 schema 호출 찾기
function hasSchemaInBlock(node: Node): boolean {
  if (node.type === 'CallExpression') {
    if (isSchemaCall(node)) {
      return true;
    }
    // 인자들 검사
    for (const arg of node.arguments) {
      if (hasSchemaInBlock(arg)) {
        return true;
      }
    }
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    if (node.body.type === 'BlockStatement') {
      for (const stmt of node.body.body) {
        if (hasSchemaInBlock(stmt)) {
          return true;
        }
      }
    } else {
      return hasSchemaInBlock(node.body);
    }
  }

  if (node.type === 'ExpressionStatement') {
    return hasSchemaInBlock(node.expression);
  }

  if (node.type === 'BlockStatement') {
    for (const stmt of node.body) {
      if (hasSchemaInBlock(stmt)) {
        return true;
      }
    }
  }

  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'response() 블록 내 schema() 정의 권장',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    messages: {
      missingSchema:
        'response() 블록에 schema() 정의를 추가하는 것을 권장합니다. 응답 스키마는 API 문서화와 검증에 도움이 됩니다.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isResponseCall(node)) {
          return;
        }

        // response()의 두 번째 인자가 콜백 함수여야 함
        const callback = node.arguments[1];
        if (!callback) {
          return;
        }

        if (
          callback.type === 'ArrowFunctionExpression' ||
          callback.type === 'FunctionExpression'
        ) {
          if (!hasSchemaInBlock(callback)) {
            context.report({
              node,
              messageId: 'missingSchema',
            });
          }
        }
      },
    };
  },
};

export default rule;

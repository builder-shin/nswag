/**
 * no-empty-response 규칙
 * 빈 response() 블록 방지
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

// 블록이 비어있는지 확인
function isEmptyBlock(node: Node): boolean {
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    if (node.body.type === 'BlockStatement') {
      // 빈 블록이거나 주석만 있는 경우
      return node.body.body.length === 0;
    }
    // 표현식 본문 (빈 객체 등)
    if (node.body.type === 'ObjectExpression' && node.body.properties.length === 0) {
      return true;
    }
    if (node.body.type === 'Literal' && node.body.value === null) {
      return true;
    }
    if (node.body.type === 'Identifier' && node.body.name === 'undefined') {
      return true;
    }
    return false;
  }

  return false;
}

// 블록 내 유효한 내용이 있는지 확인
function hasValidContent(node: Node): boolean {
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    if (node.body.type === 'BlockStatement') {
      // 최소한 하나의 실행문이 있어야 함
      for (const stmt of node.body.body) {
        if (stmt.type === 'ExpressionStatement') {
          return true;
        }
        if (stmt.type === 'ReturnStatement') {
          return true;
        }
        if (stmt.type === 'VariableDeclaration') {
          return true;
        }
      }
      return false;
    }
    // 표현식 본문이면 유효
    return true;
  }

  return true;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: '빈 response() 블록 방지',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      emptyResponse:
        'response() 블록이 비어있습니다. schema(), runTest() 등을 추가해주세요.',
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
          context.report({
            node,
            messageId: 'emptyResponse',
          });
          return;
        }

        if (
          callback.type === 'ArrowFunctionExpression' ||
          callback.type === 'FunctionExpression'
        ) {
          if (isEmptyBlock(callback) || !hasValidContent(callback)) {
            context.report({
              node,
              messageId: 'emptyResponse',
            });
          }
        }
      },
    };
  },
};

export default rule;

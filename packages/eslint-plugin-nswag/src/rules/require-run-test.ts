/**
 * require-run-test 규칙
 * response() 블록 내에 runTest() 또는 it() 호출 필수
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

// 노드가 테스트 함수 호출인지 확인
function isTestCall(node: CallExpression): boolean {
  if (node.callee.type === 'Identifier') {
    return ['runTest', 'it', 'test'].includes(node.callee.name);
  }
  return false;
}

// response 블록 내에서 테스트 호출 찾기
function hasTestInBlock(node: Node): boolean {
  if (node.type === 'CallExpression') {
    if (isTestCall(node)) {
      return true;
    }
    // 인자들 검사
    for (const arg of node.arguments) {
      if (hasTestInBlock(arg)) {
        return true;
      }
    }
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    if (node.body.type === 'BlockStatement') {
      for (const stmt of node.body.body) {
        if (hasTestInBlock(stmt)) {
          return true;
        }
      }
    } else {
      return hasTestInBlock(node.body);
    }
  }

  if (node.type === 'ExpressionStatement') {
    return hasTestInBlock(node.expression);
  }

  if (node.type === 'BlockStatement') {
    for (const stmt of node.body) {
      if (hasTestInBlock(stmt)) {
        return true;
      }
    }
  }

  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'response() 블록 내에 runTest() 또는 it() 호출 필수',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      missingTest:
        'response() 블록에는 runTest() 또는 it() 호출이 필요합니다.',
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
          if (!hasTestInBlock(callback)) {
            context.report({
              node,
              messageId: 'missingTest',
            });
          }
        }
      },
    };
  },
};

export default rule;

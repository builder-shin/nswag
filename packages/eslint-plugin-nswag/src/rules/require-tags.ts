/**
 * require-tags 규칙
 * HTTP 메서드 블록 내 tags() 정의 권장
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';

// HTTP 메서드 이름
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

// 노드가 HTTP 메서드 호출인지 확인
function isHttpMethodCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    HTTP_METHODS.includes(node.callee.name)
  );
}

// 노드가 tags() 호출인지 확인
function isTagsCall(node: CallExpression): boolean {
  return (
    node.callee.type === 'Identifier' &&
    node.callee.name === 'tags'
  );
}

// HTTP 메서드 블록 내에서 tags 호출 찾기
function hasTagsInBlock(node: Node): boolean {
  if (node.type === 'CallExpression') {
    if (isTagsCall(node)) {
      return true;
    }
    // 인자들 검사
    for (const arg of node.arguments) {
      if (hasTagsInBlock(arg)) {
        return true;
      }
    }
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    if (node.body.type === 'BlockStatement') {
      for (const stmt of node.body.body) {
        if (hasTagsInBlock(stmt)) {
          return true;
        }
      }
    } else {
      return hasTagsInBlock(node.body);
    }
  }

  if (node.type === 'ExpressionStatement') {
    return hasTagsInBlock(node.expression);
  }

  if (node.type === 'BlockStatement') {
    for (const stmt of node.body) {
      if (hasTagsInBlock(stmt)) {
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
      description: 'HTTP 메서드 블록 내 tags() 정의 권장',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    messages: {
      missingTags:
        'HTTP 메서드 블록에 tags() 정의를 추가하는 것을 권장합니다. 태그는 API 문서 구조화에 도움이 됩니다.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isHttpMethodCall(node)) {
          return;
        }

        // HTTP 메서드의 두 번째 인자가 콜백 함수여야 함
        const callback = node.arguments[1];
        if (!callback) {
          return;
        }

        if (
          callback.type === 'ArrowFunctionExpression' ||
          callback.type === 'FunctionExpression'
        ) {
          if (!hasTagsInBlock(callback)) {
            context.report({
              node,
              messageId: 'missingTags',
            });
          }
        }
      },
    };
  },
};

export default rule;

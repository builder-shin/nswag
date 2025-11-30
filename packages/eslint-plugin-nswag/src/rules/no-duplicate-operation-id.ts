/**
 * no-duplicate-operation-id 규칙
 * operationId() 중복 방지
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';

// 노드가 operationId() 호출인지 확인
function isOperationIdCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'operationId'
  );
}

// 리터럴 값 추출
function getLiteralValue(node: Node): string | undefined {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? undefined;
  }
  return undefined;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'operationId() 중복 방지',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      duplicateOperationId:
        '중복된 operationId: "{{operationId}}". operationId는 파일 내에서 고유해야 합니다.',
    },
  },

  create(context) {
    // 파일 내에서 발견된 operationId 저장
    const operationIds = new Map<string, CallExpression>();

    return {
      CallExpression(node) {
        if (!isOperationIdCall(node)) {
          return;
        }

        const arg = node.arguments[0];
        if (!arg) {
          return;
        }

        const operationId = getLiteralValue(arg);
        if (!operationId) {
          return; // 동적 값은 검사하지 않음
        }

        const existing = operationIds.get(operationId);
        if (existing) {
          context.report({
            node,
            messageId: 'duplicateOperationId',
            data: { operationId },
          });
        } else {
          operationIds.set(operationId, node);
        }
      },
    };
  },
};

export default rule;

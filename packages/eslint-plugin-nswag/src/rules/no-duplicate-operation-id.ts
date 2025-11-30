/**
 * no-duplicate-operation-id rule
 * Prevent duplicate operationId()
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';

// Check if node is an operationId() call
function isOperationIdCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'operationId'
  );
}

// Extract literal value
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
      description: 'Prevent duplicate operationId()',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      duplicateOperationId:
        'Duplicate operationId: "{{operationId}}". operationId must be unique within the file.',
    },
  },

  create(context) {
    // Store operationIds found in the file
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
          return; // Don't check dynamic values
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

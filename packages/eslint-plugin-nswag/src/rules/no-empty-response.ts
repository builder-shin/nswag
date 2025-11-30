/**
 * no-empty-response rule
 * Prevent empty response() blocks
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

// Check if block is empty
function isEmptyBlock(node: Node): boolean {
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    if (node.body.type === 'BlockStatement') {
      // Empty block or only comments
      return node.body.body.length === 0;
    }
    // Expression body (empty object, etc.)
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

// Check if block has valid content
function hasValidContent(node: Node): boolean {
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    if (node.body.type === 'BlockStatement') {
      // Must have at least one statement
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
    // Expression body is valid
    return true;
  }

  return true;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent empty response() blocks',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      emptyResponse:
        'response() block is empty. Please add schema(), runTest(), etc.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isResponseCall(node)) {
          return;
        }

        // Second argument of response() should be a callback function
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

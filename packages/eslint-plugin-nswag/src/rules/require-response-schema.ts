/**
 * require-response-schema rule
 * Recommend schema() definition in response() blocks
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

// Check if node is a schema() call
function isSchemaCall(node: CallExpression): boolean {
  return (
    node.callee.type === 'Identifier' &&
    node.callee.name === 'schema'
  );
}

// Find schema call in response block
function hasSchemaInBlock(node: Node): boolean {
  if (node.type === 'CallExpression') {
    if (isSchemaCall(node)) {
      return true;
    }
    // Check arguments
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
      description: 'Recommend schema() definition in response() blocks',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    messages: {
      missingSchema:
        'Adding schema() definition to response() block is recommended. Response schemas help with API documentation and validation.',
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

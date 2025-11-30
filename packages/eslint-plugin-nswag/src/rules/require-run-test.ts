/**
 * require-run-test rule
 * Require runTest() or it() call in response() blocks
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

// Check if node is a test function call
function isTestCall(node: CallExpression): boolean {
  if (node.callee.type === 'Identifier') {
    return ['runTest', 'it', 'test'].includes(node.callee.name);
  }
  return false;
}

// Find test call in response block
function hasTestInBlock(node: Node): boolean {
  if (node.type === 'CallExpression') {
    if (isTestCall(node)) {
      return true;
    }
    // Check arguments
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
      description: 'Require runTest() or it() call in response() blocks',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      missingTest:
        'response() block requires runTest() or it() call.',
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

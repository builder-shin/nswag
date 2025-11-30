/**
 * require-tags rule
 * Recommend tags() definition in HTTP method blocks
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';

// HTTP method names
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

// Check if node is an HTTP method call
function isHttpMethodCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    HTTP_METHODS.includes(node.callee.name)
  );
}

// Check if node is a tags() call
function isTagsCall(node: CallExpression): boolean {
  return (
    node.callee.type === 'Identifier' &&
    node.callee.name === 'tags'
  );
}

// Find tags call in HTTP method block
function hasTagsInBlock(node: Node): boolean {
  if (node.type === 'CallExpression') {
    if (isTagsCall(node)) {
      return true;
    }
    // Check arguments
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
      description: 'Recommend tags() definition in HTTP method blocks',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    messages: {
      missingTags:
        'Adding tags() definition to HTTP method block is recommended. Tags help structure API documentation.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isHttpMethodCall(node)) {
          return;
        }

        // Second argument of HTTP method should be a callback function
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

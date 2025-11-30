/**
 * prefer-request-body rule
 * Recommend requestBody() instead of parameter({ in: 'body' })
 */

import type { Rule } from 'eslint';
import type { CallExpression, ObjectExpression, Property, Node } from 'estree';

// Check if node is a parameter() call
function isParameterCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'parameter'
  );
}

// Extract property name
function getPropertyName(prop: Property): string | undefined {
  if (prop.key.type === 'Identifier') {
    return prop.key.name;
  }
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') {
    return prop.key.value;
  }
  return undefined;
}

// Extract literal value
function getLiteralValue(node: Node): unknown {
  if (node.type === 'Literal') {
    return node.value;
  }
  return undefined;
}

// Find 'in: body' in parameter call
function hasBodyLocation(node: ObjectExpression): boolean {
  for (const prop of node.properties) {
    if (prop.type !== 'Property') continue;

    const propName = getPropertyName(prop);
    if (propName === 'in') {
      const value = getLiteralValue(prop.value);
      if (value === 'body') {
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
      description: 'Recommend requestBody() instead of parameter({ in: "body" })',
      category: 'Best Practices',
      recommended: false,
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferRequestBody:
        'Use requestBody() instead of parameter({ in: "body" }). requestBody is recommended in OpenAPI 3.0.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isParameterCall(node)) {
          return;
        }

        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') {
          return;
        }

        if (hasBodyLocation(arg)) {
          context.report({
            node,
            messageId: 'preferRequestBody',
            // Auto-fix can be complex, so excluded
          });
        }
      },
    };
  },
};

export default rule;

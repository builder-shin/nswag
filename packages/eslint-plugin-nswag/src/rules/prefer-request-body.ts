/**
 * prefer-request-body 규칙
 * parameter({ in: 'body' }) 대신 requestBody() 권장
 */

import type { Rule } from 'eslint';
import type { CallExpression, ObjectExpression, Property, Node } from 'estree';

// 노드가 parameter() 호출인지 확인
function isParameterCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'parameter'
  );
}

// 속성 이름 추출
function getPropertyName(prop: Property): string | undefined {
  if (prop.key.type === 'Identifier') {
    return prop.key.name;
  }
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') {
    return prop.key.value;
  }
  return undefined;
}

// 리터럴 값 추출
function getLiteralValue(node: Node): unknown {
  if (node.type === 'Literal') {
    return node.value;
  }
  return undefined;
}

// parameter 호출에서 'in: body' 찾기
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
      description: 'parameter({ in: "body" }) 대신 requestBody() 권장',
      category: 'Best Practices',
      recommended: false,
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferRequestBody:
        'parameter({ in: "body" }) 대신 requestBody()를 사용하세요. OpenAPI 3.0에서는 requestBody가 권장됩니다.',
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
            // 자동 수정은 복잡할 수 있으므로 제외
          });
        }
      },
    };
  },
};

export default rule;

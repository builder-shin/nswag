/**
 * valid-schema 규칙
 * 스키마 객체 구조 검증
 */

import type { Rule } from 'eslint';
import type { CallExpression, ObjectExpression, Property, Node } from 'estree';

// 유효한 스키마 타입
const VALID_SCHEMA_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
  'null',
];

// 유효한 스키마 포맷
const VALID_FORMATS = [
  'date',
  'date-time',
  'time',
  'email',
  'uri',
  'uri-reference',
  'url',
  'uuid',
  'hostname',
  'ipv4',
  'ipv6',
  'int32',
  'int64',
  'float',
  'double',
  'byte',
  'binary',
  'password',
];

// 유효한 스키마 속성
const VALID_SCHEMA_PROPERTIES = new Set([
  'type',
  'format',
  'items',
  'properties',
  'additionalProperties',
  'required',
  'description',
  'title',
  'enum',
  'default',
  'nullable',
  '$ref',
  'allOf',
  'oneOf',
  'anyOf',
  'not',
  'discriminator',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'deprecated',
  'readOnly',
  'writeOnly',
  'example',
  'examples',
]);

// 노드가 schema() 호출인지 확인
function isSchemaCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'schema'
  );
}

// 리터럴 값 추출
function getLiteralValue(node: Node): unknown {
  if (node.type === 'Literal') {
    return node.value;
  }
  return undefined;
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

// 스키마 객체 검증
function validateSchemaObject(
  node: ObjectExpression,
  context: Rule.RuleContext
): void {
  let hasType = false;
  let hasRef = false;

  for (const property of node.properties) {
    if (property.type !== 'Property') continue;

    const propName = getPropertyName(property);
    if (!propName) continue;

    // 알려지지 않은 속성 검사
    if (!VALID_SCHEMA_PROPERTIES.has(propName)) {
      context.report({
        node: property,
        messageId: 'unknownProperty',
        data: { property: propName },
      });
    }

    // type 속성 검증
    if (propName === 'type') {
      hasType = true;
      const value = getLiteralValue(property.value);
      if (typeof value === 'string' && !VALID_SCHEMA_TYPES.includes(value)) {
        context.report({
          node: property.value,
          messageId: 'invalidType',
          data: { type: value },
        });
      }
    }

    // $ref 속성 검증
    if (propName === '$ref') {
      hasRef = true;
      const value = getLiteralValue(property.value);
      if (typeof value === 'string' && !value.startsWith('#/')) {
        context.report({
          node: property.value,
          messageId: 'invalidRef',
          data: { ref: value },
        });
      }
    }

    // format 속성 검증
    if (propName === 'format') {
      const value = getLiteralValue(property.value);
      if (typeof value === 'string' && !VALID_FORMATS.includes(value)) {
        context.report({
          node: property.value,
          messageId: 'unknownFormat',
          data: { format: value },
        });
      }
    }

    // items 속성 검증 (array 타입에서만 유효)
    if (propName === 'items' && property.value.type === 'ObjectExpression') {
      validateSchemaObject(property.value, context);
    }

    // properties 속성 검증
    if (propName === 'properties' && property.value.type === 'ObjectExpression') {
      for (const prop of property.value.properties) {
        if (prop.type === 'Property' && prop.value.type === 'ObjectExpression') {
          validateSchemaObject(prop.value, context);
        }
      }
    }
  }

  // type 또는 $ref 중 하나는 있어야 함
  if (!hasType && !hasRef) {
    const hasAllOf = node.properties.some(
      (p) => p.type === 'Property' && getPropertyName(p) === 'allOf'
    );
    const hasOneOf = node.properties.some(
      (p) => p.type === 'Property' && getPropertyName(p) === 'oneOf'
    );
    const hasAnyOf = node.properties.some(
      (p) => p.type === 'Property' && getPropertyName(p) === 'anyOf'
    );

    if (!hasAllOf && !hasOneOf && !hasAnyOf) {
      context.report({
        node,
        messageId: 'missingTypeOrRef',
      });
    }
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: '스키마 객체 구조 검증',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      invalidType:
        '유효하지 않은 스키마 타입: "{{type}}". 유효한 타입: string, number, integer, boolean, array, object, null',
      invalidRef:
        '유효하지 않은 $ref: "{{ref}}". $ref는 "#/"로 시작해야 합니다.',
      unknownProperty:
        '알 수 없는 스키마 속성: "{{property}}"',
      unknownFormat:
        '알 수 없는 format: "{{format}}"',
      missingTypeOrRef:
        '스키마에는 type, $ref, allOf, oneOf, anyOf 중 하나가 필요합니다.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isSchemaCall(node)) {
          return;
        }

        const arg = node.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          validateSchemaObject(arg, context);
        }
      },
    };
  },
};

export default rule;

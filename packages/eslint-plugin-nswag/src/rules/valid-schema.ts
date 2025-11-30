/**
 * valid-schema rule
 * Validate schema object structure
 */

import type { Rule } from 'eslint';
import type { CallExpression, ObjectExpression, Property, Node } from 'estree';

// Valid schema types
const VALID_SCHEMA_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
  'null',
];

// Valid schema formats
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

// Valid schema properties
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

// Check if node is a schema() call
function isSchemaCall(node: Node): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'schema'
  );
}

// Extract literal value
function getLiteralValue(node: Node): unknown {
  if (node.type === 'Literal') {
    return node.value;
  }
  return undefined;
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

// Validate schema object
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

    // Check unknown properties
    if (!VALID_SCHEMA_PROPERTIES.has(propName)) {
      context.report({
        node: property,
        messageId: 'unknownProperty',
        data: { property: propName },
      });
    }

    // Validate type property
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

    // Validate $ref property
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

    // Validate format property
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

    // Validate items property (only valid for array type)
    if (propName === 'items' && property.value.type === 'ObjectExpression') {
      validateSchemaObject(property.value, context);
    }

    // Validate properties property
    if (propName === 'properties' && property.value.type === 'ObjectExpression') {
      for (const prop of property.value.properties) {
        if (prop.type === 'Property' && prop.value.type === 'ObjectExpression') {
          validateSchemaObject(prop.value, context);
        }
      }
    }
  }

  // Must have either type or $ref
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
      description: 'Validate schema object structure',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      invalidType:
        'Invalid schema type: "{{type}}". Valid types: string, number, integer, boolean, array, object, null',
      invalidRef:
        'Invalid $ref: "{{ref}}". $ref must start with "#/".',
      unknownProperty:
        'Unknown schema property: "{{property}}"',
      unknownFormat:
        'Unknown format: "{{format}}"',
      missingTypeOrRef:
        'Schema requires one of: type, $ref, allOf, oneOf, anyOf.',
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

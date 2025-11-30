/**
 * Schema 빌더
 * JSON Schema 정의를 위한 플루언트 빌더
 */

import type { Schema } from '../types/index.js';

export class SchemaBuilder {
  private schema: Schema = {};

  type(type: string): this {
    this.schema.type = type;
    return this;
  }

  format(format: string): this {
    this.schema.format = format;
    return this;
  }

  description(text: string): this {
    this.schema.description = text;
    return this;
  }

  property(name: string, schema: Schema): this {
    if (!this.schema.properties) {
      this.schema.properties = {};
    }
    this.schema.properties[name] = schema;
    return this;
  }

  required(...fields: string[]): this {
    this.schema.required = fields;
    return this;
  }

  items(schema: Schema): this {
    this.schema.items = schema;
    return this;
  }

  enum(...values: unknown[]): this {
    this.schema.enum = values;
    return this;
  }

  nullable(value = true): this {
    this.schema.nullable = value;
    return this;
  }

  ref(reference: string): this {
    this.schema.$ref = reference;
    return this;
  }

  build(): Schema {
    return { ...this.schema };
  }
}

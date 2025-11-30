/**
 * Operation 빌더
 * HTTP 오퍼레이션 정의를 위한 플루언트 빌더
 */

import type { Operation, Parameter, RequestBody, Response } from '../types/index.js';

export class OperationBuilder {
  private operation: Partial<Operation> = {
    responses: {},
  };

  tags(...tags: string[]): this {
    this.operation.tags = tags;
    return this;
  }

  summary(text: string): this {
    this.operation.summary = text;
    return this;
  }

  description(text: string): this {
    this.operation.description = text;
    return this;
  }

  operationId(id: string): this {
    this.operation.operationId = id;
    return this;
  }

  parameter(param: Parameter): this {
    if (!this.operation.parameters) {
      this.operation.parameters = [];
    }
    this.operation.parameters.push(param);
    return this;
  }

  requestBody(body: RequestBody): this {
    this.operation.requestBody = body;
    return this;
  }

  response(statusCode: string | number, response: Response): this {
    this.operation.responses![String(statusCode)] = response;
    return this;
  }

  deprecated(value = true): this {
    this.operation.deprecated = value;
    return this;
  }

  build(): Operation {
    return {
      ...this.operation,
      responses: this.operation.responses!,
    };
  }
}

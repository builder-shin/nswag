/**
 * Path builder
 * Fluent builder for API path definitions
 */

import type { PathItem } from '../types/index.js';

export class PathBuilder {
  private path: PathItem = {};

  summary(text: string): this {
    this.path.summary = text;
    return this;
  }

  description(text: string): this {
    this.path.description = text;
    return this;
  }

  build(): PathItem {
    return { ...this.path };
  }
}

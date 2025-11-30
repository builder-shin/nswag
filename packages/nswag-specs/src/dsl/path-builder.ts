/**
 * Path 빌더
 * API 경로 정의를 위한 플루언트 빌더
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

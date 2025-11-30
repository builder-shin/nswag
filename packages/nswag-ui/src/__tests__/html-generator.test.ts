/**
 * HTML 생성기 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  generateSwaggerUIHtml,
  generateRedocHtml,
} from '../html-generator.js';

describe('HTML Generator', () => {
  describe('generateSwaggerUIHtml', () => {
    it('단일 스펙 URL로 HTML을 생성해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('swagger-ui');
      expect(html).toContain('/api-docs/openapi.json');
    });

    it('다중 스펙 URL로 HTML을 생성해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrls: [
          { url: '/api-docs/v1/openapi.json', name: 'API V1' },
          { url: '/api-docs/v2/openapi.json', name: 'API V2' },
        ],
        primaryName: 'API V2',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('swagger-ui');
      expect(html).toContain('urls');
      expect(html).toContain('API V1');
      expect(html).toContain('API V2');
    });

    it('커스텀 사이트 제목을 적용해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customSiteTitle: 'My API Docs',
      });

      expect(html).toContain('<title>My API Docs</title>');
    });

    it('커스텀 CSS를 포함해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customCss: '.swagger-ui { background: red; }',
      });

      expect(html).toContain('.swagger-ui { background: red; }');
    });

    it('커스텀 CSS URL을 포함해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customCssUrl: '/custom-swagger.css',
      });

      expect(html).toContain('href="/custom-swagger.css"');
    });

    it('커스텀 JavaScript를 포함해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customJs: 'console.log("custom");',
      });

      expect(html).toContain('console.log("custom");');
    });

    it('커스텀 파비콘을 적용해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customFavicon: '/my-favicon.ico',
      });

      expect(html).toContain('href="/my-favicon.ico"');
    });

    it('Swagger UI 설정 객체를 적용해야 함', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        configObject: {
          displayRequestDuration: true,
          filter: true,
        },
      });

      expect(html).toContain('displayRequestDuration');
      expect(html).toContain('filter');
    });
  });

  describe('generateRedocHtml', () => {
    it('스펙 URL로 HTML을 생성해야 함', () => {
      const html = generateRedocHtml({
        specUrl: '/api-docs/openapi.json',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('redoc');
      expect(html).toContain('/api-docs/openapi.json');
    });

    it('커스텀 사이트 제목을 적용해야 함', () => {
      const html = generateRedocHtml({
        specUrl: '/api-docs/openapi.json',
        customSiteTitle: 'My Redoc Docs',
      });

      expect(html).toContain('<title>My Redoc Docs</title>');
    });

    it('커스텀 CSS를 포함해야 함', () => {
      const html = generateRedocHtml({
        specUrl: '/api-docs/openapi.json',
        customCss: 'body { background: blue; }',
      });

      expect(html).toContain('body { background: blue; }');
    });

    it('Redoc 옵션을 적용해야 함', () => {
      const html = generateRedocHtml({
        specUrl: '/api-docs/openapi.json',
        options: {
          hideDownloadButton: true,
          nativeScrollbars: true,
        },
      });

      expect(html).toContain('hideDownloadButton');
      expect(html).toContain('nativeScrollbars');
    });
  });
});

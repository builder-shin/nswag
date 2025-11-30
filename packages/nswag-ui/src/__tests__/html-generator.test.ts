/**
 * HTML generator tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateSwaggerUIHtml,
  generateRedocHtml,
} from '../html-generator.js';

describe('HTML Generator', () => {
  describe('generateSwaggerUIHtml', () => {
    it('should generate HTML with single spec URL', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('swagger-ui');
      expect(html).toContain('/api-docs/openapi.json');
    });

    it('should generate HTML with multiple spec URLs', () => {
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

    it('should apply custom site title', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customSiteTitle: 'My API Docs',
      });

      expect(html).toContain('<title>My API Docs</title>');
    });

    it('should include custom CSS', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customCss: '.swagger-ui { background: red; }',
      });

      expect(html).toContain('.swagger-ui { background: red; }');
    });

    it('should include custom CSS URL', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customCssUrl: '/custom-swagger.css',
      });

      expect(html).toContain('href="/custom-swagger.css"');
    });

    it('should include custom JavaScript', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customJs: 'console.log("custom");',
      });

      expect(html).toContain('console.log("custom");');
    });

    it('should apply custom favicon', () => {
      const html = generateSwaggerUIHtml({
        specUrl: '/api-docs/openapi.json',
        customFavicon: '/my-favicon.ico',
      });

      expect(html).toContain('href="/my-favicon.ico"');
    });

    it('should apply Swagger UI configuration object', () => {
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
    it('should generate HTML with spec URL', () => {
      const html = generateRedocHtml({
        specUrl: '/api-docs/openapi.json',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('redoc');
      expect(html).toContain('/api-docs/openapi.json');
    });

    it('should apply custom site title', () => {
      const html = generateRedocHtml({
        specUrl: '/api-docs/openapi.json',
        customSiteTitle: 'My Redoc Docs',
      });

      expect(html).toContain('<title>My Redoc Docs</title>');
    });

    it('should include custom CSS', () => {
      const html = generateRedocHtml({
        specUrl: '/api-docs/openapi.json',
        customCss: 'body { background: blue; }',
      });

      expect(html).toContain('body { background: blue; }');
    });

    it('should apply Redoc options', () => {
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

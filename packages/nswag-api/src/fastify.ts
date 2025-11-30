/**
 * Fastify plugin
 * Exposes OpenAPI specs as JSON/YAML endpoints in Fastify apps
 *
 * @example
 * ```typescript
 * import { nswagApiPlugin } from '@aspect/nswag-api/fastify';
 *
 * app.register(nswagApiPlugin, {
 *   prefix: '/api-docs',
 *   openapiRoot: './openapi',
 * });
 *
 * // GET /api-docs/v1/openapi.json -> returns ./openapi/v1/openapi.json contents
 * ```
 */

import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import { resolve } from 'node:path';
import {
  parseRequestPath,
  loadOpenAPIFile,
  serializeOpenAPI,
  getContentType,
  cloneOpenAPI,
} from './spec-loader.js';
import { validateAuth, getAuthErrorStatusCode } from './auth.js';
import {
  getCorsHeaders,
  getPreflightHeaders,
  isPreflightRequest,
  getOriginFromHeaders,
} from './cors.js';
import {
  DEFAULT_OPTIONS,
  type FastifyNswagApiOptions,
  type FastifyRequest as FastifyRequestType,
} from './types.js';

/**
 * Fastify plugin
 * Provides OpenAPI specs as JSON/YAML endpoints
 */
export const nswagApiPlugin: FastifyPluginCallback<FastifyNswagApiOptions> = (
  fastify: FastifyInstance,
  options: FastifyNswagApiOptions,
  done: (err?: Error) => void
) => {
  const {
    openapiRoot,
    cache = DEFAULT_OPTIONS.cache,
    cors = DEFAULT_OPTIONS.cors,
    auth,
    openapiFilter,
    openapiHeaders = DEFAULT_OPTIONS.openapiHeaders,
  } = options;

  // Convert openapiRoot to absolute path
  const absoluteRoot = resolve(process.cwd(), openapiRoot);

  // Register wildcard route (handles all sub-paths)
  fastify.route({
    method: ['GET', 'OPTIONS'],
    url: '/*',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const headers = request.headers as Record<string, string | string[] | undefined>;

      // Handle CORS preflight request
      if (isPreflightRequest(request.method)) {
        if (cors.enabled) {
          const origin = getOriginFromHeaders(headers);
          const preflightHeaders = getPreflightHeaders(origin, cors);

          if (preflightHeaders) {
            Object.entries(preflightHeaders).forEach(([key, value]) => {
              if (value) reply.header(key, value);
            });
          }
        }
        return reply.status(204).send();
      }

      // Parse request path (remove prefix)
      const requestPath = request.url.replace(/\?.*$/, ''); // Remove query string
      const fileInfo = parseRequestPath(requestPath, absoluteRoot);

      if (!fileInfo) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Invalid OpenAPI spec path',
        });
      }

      // Validate authentication
      if (auth?.enabled) {
        const authResult = validateAuth(headers, auth);

        if (!authResult.success) {
          const statusCode = getAuthErrorStatusCode(auth);
          if (authResult.wwwAuthenticate) {
            reply.header('WWW-Authenticate', authResult.wwwAuthenticate);
          }
          return reply.status(statusCode).send({
            error: authResult.error,
          });
        }
      }

      // Set CORS headers
      if (cors.enabled) {
        const origin = getOriginFromHeaders(headers);
        const corsHeaders = getCorsHeaders(origin, cors);

        if (corsHeaders) {
          Object.entries(corsHeaders).forEach(([key, value]) => {
            if (value) reply.header(key, value);
          });
        }
      }

      // Load OpenAPI file
      let spec = loadOpenAPIFile(fileInfo.absolutePath, cache);
      if (!spec) {
        return reply.status(404).send({
          error: 'OpenAPI spec not found',
          path: fileInfo.relativePath,
        });
      }

      // Apply dynamic filter
      if (openapiFilter) {
        try {
          // Create a copy to prevent modifying the original
          spec = cloneOpenAPI(spec);
          const fastifyReq: FastifyRequestType = {
            headers,
            session: (request as unknown as { session?: FastifyRequestType['session'] }).session,
            url: request.url,
            method: request.method,
          };
          spec = await openapiFilter(spec, fastifyReq);
        } catch (error) {
          return reply.status(500).send({
            error: 'Filter error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Set response headers
      const contentType = getContentType(fileInfo.format);
      reply.header('Content-Type', contentType);

      // Apply custom headers
      Object.entries(openapiHeaders).forEach(([key, value]) => {
        if (value) reply.header(key, value);
      });

      // Send response
      const body = serializeOpenAPI(spec, fileInfo.format);
      return reply.send(body);
    },
  });

  done();
};

// Plugin metadata
(nswagApiPlugin as unknown as Record<symbol, unknown>)[Symbol.for('fastify.display-name')] = 'nswag-api';
(nswagApiPlugin as unknown as Record<symbol, unknown>)[Symbol.for('skip-override')] = true;

// Default export
export default nswagApiPlugin;

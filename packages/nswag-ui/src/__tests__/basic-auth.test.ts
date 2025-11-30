/**
 * Basic Auth tests
 */

import { describe, it, expect } from 'vitest';
import {
  verifyBasicAuth,
  validateBasicAuth,
} from '../basic-auth.js';
import type { BasicAuthConfig } from '../types.js';

describe('Basic Auth', () => {
  const validConfig: BasicAuthConfig = {
    enabled: true,
    credentials: {
      username: 'admin',
      password: 'secret',
    },
  };

  const disabledConfig: BasicAuthConfig = {
    enabled: false,
    credentials: {
      username: 'admin',
      password: 'secret',
    },
  };

  describe('verifyBasicAuth', () => {
    it('should return authentication success when disabled', () => {
      const result = verifyBasicAuth('anything', disabledConfig);
      expect(result.authenticated).toBe(true);
    });

    it('should return authentication failure when Authorization header is missing', () => {
      const result = verifyBasicAuth(undefined, validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should return authentication failure when not Basic Auth format', () => {
      const result = verifyBasicAuth('Bearer token123', validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should return authentication success with correct credentials', () => {
      // admin:secret -> Base64 encoding
      const credentials = Buffer.from('admin:secret').toString('base64');
      const result = verifyBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result.authenticated).toBe(true);
    });

    it('should return authentication failure with incorrect username', () => {
      const credentials = Buffer.from('wrong:secret').toString('base64');
      const result = verifyBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should return authentication failure with incorrect password', () => {
      const credentials = Buffer.from('admin:wrong').toString('base64');
      const result = verifyBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should return authentication failure with invalid Base64', () => {
      const result = verifyBasicAuth('Basic invalid-base64!!!', validConfig);
      expect(result.authenticated).toBe(false);
    });

    it('should include WWW-Authenticate header on authentication failure', () => {
      const result = verifyBasicAuth(undefined, validConfig);
      expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="API Documentation"');
    });
  });

  describe('validateBasicAuth', () => {
    it('should return true when config is not provided', () => {
      const result = validateBasicAuth('anything', undefined);
      expect(result).toBe(true);
    });

    it('should return true when disabled', () => {
      const result = validateBasicAuth('anything', disabledConfig);
      expect(result).toBe(true);
    });

    it('should return true with correct credentials', () => {
      const credentials = Buffer.from('admin:secret').toString('base64');
      const result = validateBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result).toBe(true);
    });

    it('should return false with incorrect credentials', () => {
      const credentials = Buffer.from('admin:wrong').toString('base64');
      const result = validateBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result).toBe(false);
    });
  });
});

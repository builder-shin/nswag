/**
 * Basic Auth 테스트
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
    it('비활성화된 경우 인증 성공을 반환해야 함', () => {
      const result = verifyBasicAuth('anything', disabledConfig);
      expect(result.authenticated).toBe(true);
    });

    it('Authorization 헤더가 없는 경우 인증 실패를 반환해야 함', () => {
      const result = verifyBasicAuth(undefined, validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('Basic Auth 형식이 아닌 경우 인증 실패를 반환해야 함', () => {
      const result = verifyBasicAuth('Bearer token123', validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('올바른 자격 증명으로 인증 성공을 반환해야 함', () => {
      // admin:secret -> Base64 인코딩
      const credentials = Buffer.from('admin:secret').toString('base64');
      const result = verifyBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result.authenticated).toBe(true);
    });

    it('잘못된 사용자 이름으로 인증 실패를 반환해야 함', () => {
      const credentials = Buffer.from('wrong:secret').toString('base64');
      const result = verifyBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('잘못된 비밀번호로 인증 실패를 반환해야 함', () => {
      const credentials = Buffer.from('admin:wrong').toString('base64');
      const result = verifyBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('잘못된 Base64로 인증 실패를 반환해야 함', () => {
      const result = verifyBasicAuth('Basic invalid-base64!!!', validConfig);
      expect(result.authenticated).toBe(false);
    });

    it('인증 실패 시 WWW-Authenticate 헤더를 포함해야 함', () => {
      const result = verifyBasicAuth(undefined, validConfig);
      expect(result.headers?.['WWW-Authenticate']).toBe('Basic realm="API Documentation"');
    });
  });

  describe('validateBasicAuth', () => {
    it('설정이 없는 경우 true를 반환해야 함', () => {
      const result = validateBasicAuth('anything', undefined);
      expect(result).toBe(true);
    });

    it('비활성화된 경우 true를 반환해야 함', () => {
      const result = validateBasicAuth('anything', disabledConfig);
      expect(result).toBe(true);
    });

    it('올바른 자격 증명으로 true를 반환해야 함', () => {
      const credentials = Buffer.from('admin:secret').toString('base64');
      const result = validateBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result).toBe(true);
    });

    it('잘못된 자격 증명으로 false를 반환해야 함', () => {
      const credentials = Buffer.from('admin:wrong').toString('base64');
      const result = validateBasicAuth(`Basic ${credentials}`, validConfig);
      expect(result).toBe(false);
    });
  });
});

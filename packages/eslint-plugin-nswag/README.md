# @builder-shin/eslint-plugin-nswag

`@builder-shin/nswag-specs` DSL을 위한 ESLint 플러그인입니다.

## 설치

```bash
npm install @builder-shin/eslint-plugin-nswag --save-dev
# 또는
pnpm add -D @builder-shin/eslint-plugin-nswag
```

## 설정

### ESLint Flat Config (eslint.config.js)

```javascript
import nswagPlugin from '@builder-shin/eslint-plugin-nswag';

export default [
  {
    files: ['**/*.spec.ts'],
    plugins: {
      '@builder-shin/nswag': nswagPlugin,
    },
    rules: {
      ...nswagPlugin.configs.recommended.rules,
    },
  },
];
```

### 사전 정의된 설정

#### recommended

일반적인 사용에 권장되는 설정입니다.

```javascript
import nswagPlugin from '@builder-shin/eslint-plugin-nswag';

export default [
  {
    plugins: { '@builder-shin/nswag': nswagPlugin },
    rules: nswagPlugin.configs.recommended.rules,
  },
];
```

#### strict

모든 규칙을 `error`로 적용하는 엄격한 설정입니다.

```javascript
import nswagPlugin from '@builder-shin/eslint-plugin-nswag';

export default [
  {
    plugins: { '@builder-shin/nswag': nswagPlugin },
    rules: nswagPlugin.configs.strict.rules,
  },
];
```

## 규칙

| 규칙 | 설명 | Recommended | Strict |
|------|------|-------------|--------|
| [require-run-test](#require-run-test) | `response()` 블록에 `runTest()` 또는 `it()` 호출 필수 | error | error |
| [valid-schema](#valid-schema) | schema 객체 구조 검증 | error | error |
| [no-duplicate-operation-id](#no-duplicate-operation-id) | 중복 `operationId` 방지 | error | error |
| [no-empty-response](#no-empty-response) | 빈 `response()` 블록 방지 | error | error |
| [valid-http-status](#valid-http-status) | 유효한 HTTP 상태 코드(100-599)만 허용 | error | error |
| [require-response-schema](#require-response-schema) | `response()` 블록에 `schema()` 정의 권장 | warn | error |
| [require-tags](#require-tags) | HTTP 메서드 블록에 `tags()` 정의 권장 | warn | error |
| [prefer-request-body](#prefer-request-body) | `parameter({ in: 'body' })` 대신 `requestBody()` 사용 권장 | warn | error |

---

### require-run-test

`response()` 블록 내에 `runTest()`, `it()`, 또는 `test()` 호출이 있어야 합니다.

```typescript
// ❌ 잘못된 예
response(200, () => {
  schema({ type: 'object' });
});

// ✅ 올바른 예
response(200, () => {
  schema({ type: 'object' });
  runTest('사용자 목록 조회', async (ctx) => {
    // 테스트 로직
  });
});
```

---

### valid-schema

`schema()` 호출 시 OpenAPI 스키마 구조를 검증합니다.

- `type`, `$ref`, `allOf`, `oneOf`, `anyOf` 중 하나가 필수
- 유효한 타입: `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`
- 유효한 format 검증
- 알 수 없는 속성 경고

```typescript
// ❌ 잘못된 예
schema({ format: 'email' }); // type 누락
schema({ type: 'invalid' }); // 유효하지 않은 type

// ✅ 올바른 예
schema({ type: 'string', format: 'email' });
schema({ $ref: '#/components/schemas/User' });
```

---

### no-duplicate-operation-id

파일 내에서 `operationId` 값이 중복되지 않아야 합니다.

```typescript
// ❌ 잘못된 예
get('/users', () => {
  operationId('getUsers');
});
get('/users/all', () => {
  operationId('getUsers'); // 중복
});

// ✅ 올바른 예
get('/users', () => {
  operationId('getUsers');
});
get('/users/all', () => {
  operationId('getAllUsers');
});
```

---

### no-empty-response

`response()` 블록이 비어있으면 안 됩니다.

```typescript
// ❌ 잘못된 예
response(200, () => {});
response(200, () => null);

// ✅ 올바른 예
response(200, () => {
  schema({ type: 'object' });
});
```

---

### valid-http-status

`response()` 첫 번째 인자로 유효한 HTTP 상태 코드(100-599)만 허용합니다.

**옵션:**
- `warnOnNonStandard` (boolean, 기본값: `false`): RFC 표준이 아닌 상태 코드 사용 시 경고

```typescript
// ❌ 잘못된 예
response(600, () => { /* ... */ }); // 범위 초과
response(99, () => { /* ... */ });  // 범위 미만

// ✅ 올바른 예
response(200, () => { /* ... */ });
response(404, () => { /* ... */ });
```

---

### require-response-schema

`response()` 블록 내에 `schema()` 정의를 권장합니다.

```typescript
// ⚠️ 경고
response(200, () => {
  runTest('테스트', async () => {});
});

// ✅ 권장
response(200, () => {
  schema({ type: 'object', properties: { id: { type: 'integer' } } });
  runTest('테스트', async () => {});
});
```

---

### require-tags

HTTP 메서드(`get`, `post`, `put`, `patch`, `delete` 등) 블록 내에 `tags()` 정의를 권장합니다.

```typescript
// ⚠️ 경고
get('/users', () => {
  operationId('getUsers');
  response(200, () => { /* ... */ });
});

// ✅ 권장
get('/users', () => {
  tags('Users');
  operationId('getUsers');
  response(200, () => { /* ... */ });
});
```

---

### prefer-request-body

OpenAPI 3.0 스펙에 맞게 `parameter({ in: 'body' })` 대신 `requestBody()`를 사용하도록 권장합니다.

```typescript
// ⚠️ 경고 (OpenAPI 2.0 스타일)
post('/users', () => {
  parameter({ name: 'body', in: 'body', schema: { type: 'object' } });
});

// ✅ 권장 (OpenAPI 3.0 스타일)
post('/users', () => {
  requestBody({
    content: {
      'application/json': {
        schema: { type: 'object' }
      }
    }
  });
});
```

## 라이선스

MIT

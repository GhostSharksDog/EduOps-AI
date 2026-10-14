# Test Helpers

Shared test utilities to reduce duplication across test files.

## Structure

```
tests/helpers/
├── constants/
│   └── index.ts            # 🆕 Single source of truth for all test constants
├── auth.ts                 # Re-exports from constants (backward compatible)
├── test-data.ts            # Test data creation + re-exports from constants
├── transaction.ts          # Transaction helpers + re-exports from constants
├── api-test-utils.ts       # API route test helpers
└── fixtures/               # Entity test fixtures
    ├── segment-fixtures.ts
    └── data-model-fixtures.ts
```

## Constants (Preferred)

All test constants are centralized in `constants/index.ts`:

```typescript
import {
  TEST_USER_ID,
  TEST_JWT,
  AUTH_HEADERS,
  generateTestUuid,
  generateTestId,
} from '../helpers/constants';

// Use pre-configured auth headers
const response = await fetch('/api/tags', { headers: AUTH_HEADERS });

// Generate unique test IDs
const id = generateTestUuid();        // '00000000-0000-0000-0000-000000000001'
const dsId = generateTestId('ds');    // 'ds-000000000001'
```

### Available Constants

| Constant | Value | Usage |
|----------|-------|-------|
| `TEST_USER_ID` | `...0001` | Primary test user |
| `LEGACY_TEST_USER_ID` | `...0000` | Backward compatibility |
| `SYSTEM_ID` | `process.env.SYSTEM_USER_ID` | System operations (from .env) |
| `TEST_ORG_ID` | `...0003` | Test organization |
| `TEST_CATEGORY_ID` | `...0004` | Test tag category |
| `NON_EXISTENT_ID` | `ffff-...` | Testing "not found" scenarios |
| `TEST_JWT` | JWT with TEST_USER_ID | Auth header |
| `AUTH_HEADERS` | `{ Authorization: Bearer ... }` | Pre-configured headers |

### ID Generators

```typescript
generateTestUuid()      // Sequential UUID for debugging
generateTestId('tag')   // Prefixed ID: 'tag-000000000001'
resetTestIdCounter()    // Reset between test suites
```

### Database Configuration

Database settings are read from `.env` file:

```typescript
import { TEST_DATABASE_CONFIG, DEFAULT_TEST_DB } from '../helpers/constants';

// Use pre-configured database settings (from .env)
const ds = createTestDataSource({
  type: 'CLICKHOUSE',
  host: TEST_DATABASE_CONFIG.CLICKHOUSE.host,    // CLICKHOUSE_HOST from .env
  port: TEST_DATABASE_CONFIG.CLICKHOUSE.port,    // CLICKHOUSE_PORT from .env
  username: TEST_DATABASE_CONFIG.CLICKHOUSE.username, // CLICKHOUSE_USER from .env
});

// Available configs (all read from .env):
// - TEST_DATABASE_CONFIG.CLICKHOUSE (CLICKHOUSE_HOST/PORT/USER/PASSWORD/DATABASE)
// - TEST_DATABASE_CONFIG.POSTGRESQL (parsed from DATABASE_URL)
// - TEST_DATABASE_CONFIG.MYSQL (MYSQL_HOST/PORT/USER/PASSWORD/DATABASE)
// - DEFAULT_TEST_DB = TEST_DATABASE_CONFIG.POSTGRESQL
```

### Server Configuration

```typescript
import { TEST_SERVER_CONFIG } from '../helpers/constants';

// Server settings from .env
const url = `${TEST_SERVER_CONFIG.baseUrl}/api/tags`; // http://localhost:{PORT}/api/tags
```

## Backward Compatibility

Old imports still work (re-exported from constants):

```typescript
// These still work:
import { testJWT, testUserId, authHeaders } from '../helpers/auth';
import { TEST_USER_ID, generateTestUuid } from '../helpers/test-data';
import { TEST_USER_ID, generateTestId } from '../helpers/transaction';

// But prefer direct import from constants:
import { TEST_USER_ID, TEST_JWT, generateTestUuid } from '../helpers/constants';
```

## Entity Fixtures

```typescript
import { createTestSegment } from '../helpers/fixtures/segment-fixtures';
import { createTestDataModel, createTestDataSource } from '../helpers/fixtures/data-model-fixtures';

// Create with defaults (uses TEST_USER_ID)
const segment = createTestSegment();

// Create with overrides
const segment = createTestSegment({
  name: 'Custom Segment',
  status: SegmentStatus.ACTIVE,
});
```

## Benefits

1. **Single Source of Truth**: All constants in one file
2. **UUID Consistency**: JWT userId matches TEST_USER_ID
3. **Backward Compatible**: Old imports still work
4. **Reduced Duplication**: `TEST_USER_ID` (477 bytes × 20+ files) → single import
5. **Type Safety**: Fixtures return properly typed entities

/**
 * Test Constants - Single Source of Truth
 *
 * All test-related IDs, tokens, and mock data defined here.
 * 集成测试只从显式的测试环境读取配置；本文件不会加载 .env。
 * Import from '@/tests/helpers/constants' in test files.
 *
 * @example
 * ```ts
 * import { TEST_USER_ID, AUTH_HEADERS, generateTestUuid } from '@/tests/helpers/constants';
 * ```
 */

import { randomUUID } from 'crypto';

// ============================================
// User & Auth Constants
// ============================================

/** Primary test user - used in most tests */
export const TEST_USER_ID = 'a0000000-0000-4000-8000-000000000001';
export const TEST_ADMIN_ID = 'a0000000-0000-4000-8000-000000000002';

/** Test organization ID */
export const TEST_ORG_ID = 'a0000000-0000-4000-8000-000000000003';

export const NON_EXISTENT_ID = '00000000-dead-beef-dead-beef00000000';

/** Test tag category ID */
export const TEST_CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001';

/** Test admin roles */
export const TEST_ADMIN_ROLES = ['admin'];

// ============================================
// JWT Token (matches TEST_USER_ID)
// ============================================

/**
 * Valid JWT for TEST_USER_ID
 * Decoded payload: { username: "test-user", userId: "00000000-0000-0000-0000-000000000001", roles: ["ROLE_ADMIN"] }
 */
export const TEST_JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3QtdXNlciIsInVzZXJJZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsInJvbGVzIjpbIlJPTEVfQURNSU4iXSwiaWF0IjoxNzAzNzI4MDAwLCJleHAiOjE5OTk5OTk5OTl9.test-signature`;

/** Pre-configured headers with Bearer token for authenticated requests */
export const AUTH_HEADERS = {
  Authorization: `Bearer ${TEST_JWT}`,
};

// ============================================
// Error Response Templates
// ============================================

export const UNAUTHORIZED_RESPONSE = {
  error: 'Unauthorized',
  message: 'Missing or invalid Authorization header',
};

export const SERVER_ERROR_RESPONSE = {
  error: 'Internal Server Error',
  message: 'An unexpected error occurred',
};

// Legacy aliases for backward compatibility
export const missingAuthResponse = UNAUTHORIZED_RESPONSE;
export const serviceErrorResponse = SERVER_ERROR_RESPONSE;

// ============================================
// ID Generators
// ============================================

let idCounter = 0;

/**
 * Generate a unique UUID for testing purposes.
 * Uses randomUUID() to ensure no conflicts with existing data.
 */
export function generateTestUuid(): string {
  return randomUUID();
}

/**
 * Generate a random UUID for testing purposes.
 * Use this when you need unique IDs that won't conflict with existing data.
 */
export function generateRandomTestUuid(): string {
  return randomUUID();
}

/**
 * Reset the test ID counter.
 * Call this at the beginning of test suites to ensure predictable IDs.
 */
export function resetTestIdCounter(): void {
  idCounter = 0;
}

/**
 * Generate prefixed ID for readability
 * @param prefix - e.g., 'ds' for datasource, 'dm' for data model
 * @returns e.g., 'ds-000000000001'
 */
export function generateTestId(prefix: string): string {
  idCounter++;
  const suffix = idCounter.toString().padStart(12, '0').slice(-12);
  return `${prefix}-${suffix}`;
}

// ============================================
// Test Database Configuration (from .env)
// ============================================

/**
 * Parse DATABASE_URL to extract connection parameters
 * Format: postgresql://username:password@host:port/database
 */
function parseDatabaseUrl(url: string | undefined) {
  if (!url) {
    return { host: 'localhost', port: 5432, database: 'test_db', username: 'test_user', password: 'test_pass' };
  }
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      database: parsed.pathname.slice(1),
      username: parsed.username,
      password: parsed.password || '',
    };
  } catch {
    return { host: 'localhost', port: 5432, database: 'test_db', username: 'test_user', password: 'test_pass' };
  }
}

const pgConfig = parseDatabaseUrl(process.env.DATABASE_URL);

export const TEST_DATABASE_CONFIG = {
  CLICKHOUSE: {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
    database: process.env.CLICKHOUSE_DATABASE || 'metadata',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },
  POSTGRESQL: {
    host: pgConfig.host,
    port: pgConfig.port,
    database: pgConfig.database,
    username: pgConfig.username,
    password: pgConfig.password,
  },
  MYSQL: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    database: process.env.MYSQL_DATABASE || 'test_db',
    username: process.env.MYSQL_USER || 'test_user',
    password: process.env.MYSQL_PASSWORD || 'test_pass',
  },
} as const;

/** Default database config (PostgreSQL) */
export const DEFAULT_TEST_DB = TEST_DATABASE_CONFIG.POSTGRESQL;

// ============================================
// Test Server Configuration (isolated test server)
// ============================================

export const TEST_SERVER_CONFIG = {
  port: parseInt(process.env.TEST_PORT || '3119'),
  host: 'localhost',
  baseUrl: process.env.TEST_SERVER_URL || `http://localhost:${process.env.TEST_PORT || '3119'}`,
} as const;

/**
 * Test Setup - No Mocks
 *
 * All tests use real database connections.
 * Database setup is handled by setup-database.ts
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock server-only module for testing
vi.mock('server-only', () => ({}));

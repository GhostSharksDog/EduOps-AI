/**
 * Test Setup - No Mocks
 *
 * All tests use real database connections.
 * Database setup is handled by setup-database.ts
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import {configureTestCompanyContext} from '@/platform/company/context';
import {getDefaultCompany} from '@/platform/company/registry';
configureTestCompanyContext(getDefaultCompany().code);

// Mock server-only module for testing
vi.mock('server-only', () => ({}));

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import { DataSourceType, TestConnectionResult } from '@/shared/enums/datasource/index';

// Mock logger to prevent console noise
vi.mock('@/platform/logger', () => ({
    log: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

// Control flags for test scenarios
let __KNEX_FAIL = false;
let __KNEX_ERROR_MSG = 'knex connection failed';
let __KNEX_VERSION = 'PostgreSQL 15.2';
let __KNEX_RESPONSE_FORMAT: 'rows' | 'array' = 'rows';
let __CH_FAIL = false;
let __CH_VERSION: string | undefined = '22.3.0';
let __KNEX_THROW_ON_CREATE = false;
let __KNEX_THROW_NON_ERROR = false;
let __DESTROY_SPY: ReturnType<typeof vi.fn> = vi.fn();

// Mock knex - must use a factory that returns a function as default export
vi.mock('knex', () => {
    const createMockKnex = () => {
        const mockFn = vi.fn(() => {
            // @ts-expect-error - accessing test globals
            const knexFail = globalThis.__KNEX_FAIL || false;
            // @ts-expect-error - accessing test globals
            const knexThrowOnCreate = globalThis.__KNEX_THROW_ON_CREATE || false;
            // @ts-expect-error - accessing test globals
            const knexThrowNonError = globalThis.__KNEX_THROW_NON_ERROR || false;
            // @ts-expect-error - accessing test globals
            const destroySpy = globalThis.__DESTROY_SPY || vi.fn();

            if (knexThrowOnCreate) {
                throw knexThrowNonError ? 'string error' : new Error('create failed');
            }

            const instance = {
                raw: vi.fn(async (sql: string) => {
                    // @ts-expect-error - accessing test globals
                    if (globalThis.__KNEX_FAIL) {
                        // @ts-expect-error - accessing test globals
                        throw new Error(globalThis.__KNEX_ERROR_MSG || 'knex connection failed');
                    }
                    // @ts-expect-error - accessing test globals
                    const format = globalThis.__KNEX_RESPONSE_FORMAT || 'rows';
                    // @ts-expect-error - accessing test globals - use nullish coalescing to allow empty strings
                    const version = globalThis.__KNEX_VERSION ?? 'PostgreSQL 15.2';
                    
                    if (format === 'array') {
                        return [[{ version }]];
                    }
                    return { rows: [{ version }] };
                }),
                destroy: destroySpy,
            };
            return instance;
        });
        return mockFn;
    };

    return {
        default: createMockKnex(),
        Knex: { Config: {} },
    };
});

// Mock ClickHouse module
vi.mock('clickhouse', () => {
    return {
        ClickHouse: class MockClickHouse {
            constructor(_config: unknown) {}
            query(sql: string) {
                return {
                    toPromise: async () => {
                        // @ts-expect-error - accessing test globals
                        if (globalThis.__CH_FAIL) {
                            throw new Error('clickhouse connection failed');
                        }
                        if (sql.includes('version')) {
                            // @ts-expect-error - accessing test globals - use nullish coalescing to allow empty strings
                            return [{ version: globalThis.__CH_VERSION ?? '22.3.0' }];
                        }
                        return [];
                    },
                };
            }
        },
    };
});

// Import AFTER mocks are defined
import { DatasourceClientAdapterImpl } from '@/platform/database/impl/DatasourceClientAdapterImpl';

// Helper function to create a DataSource instance
function createDataSource(overrides: Partial<DataSource> = {}): DataSource {
    return new DataSource(
        overrides.id ?? 'ds-001',
        overrides.name ?? 'Test DataSource',
        overrides.ownedBy ?? 'user-001',
        overrides.createTime ?? new Date(),
        overrides.createdBy ?? 'user-001',
        overrides.description,
        overrides.type ?? DataSourceType.POSTGRESQL,
        overrides.host ?? 'localhost',
        overrides.port ?? 5432,
        overrides.databaseName ?? 'testdb',
        overrides.username ?? 'testuser',
        overrides.password ?? 'testpass',
        overrides.status,
        overrides.isDeleted ?? false,
        overrides.feature,
        overrides.updateTime,
        overrides.deleteTime,
        overrides.updatedBy,
        overrides.deletedBy
    );
}

function setGlobalFlags() {
    // @ts-expect-error - setting test globals
    globalThis.__KNEX_FAIL = __KNEX_FAIL;
    // @ts-expect-error - setting test globals
    globalThis.__KNEX_ERROR_MSG = __KNEX_ERROR_MSG;
    // @ts-expect-error - setting test globals
    globalThis.__KNEX_VERSION = __KNEX_VERSION;
    // @ts-expect-error - setting test globals
    globalThis.__KNEX_RESPONSE_FORMAT = __KNEX_RESPONSE_FORMAT;
    // @ts-expect-error - setting test globals
    globalThis.__CH_FAIL = __CH_FAIL;
    // @ts-expect-error - setting test globals
    globalThis.__CH_VERSION = __CH_VERSION;
    // @ts-expect-error - setting test globals
    globalThis.__KNEX_THROW_ON_CREATE = __KNEX_THROW_ON_CREATE;
    // @ts-expect-error - setting test globals
    globalThis.__KNEX_THROW_NON_ERROR = __KNEX_THROW_NON_ERROR;
    // @ts-expect-error - setting test globals
    globalThis.__DESTROY_SPY = __DESTROY_SPY;
}

function resetFlags() {
    __KNEX_FAIL = false;
    __KNEX_ERROR_MSG = 'knex connection failed';
    __KNEX_VERSION = 'PostgreSQL 15.2';
    __KNEX_RESPONSE_FORMAT = 'rows';
    __CH_FAIL = false;
    __CH_VERSION = '22.3.0';
    __KNEX_THROW_ON_CREATE = false;
    __KNEX_THROW_NON_ERROR = false;
    __DESTROY_SPY = vi.fn();
    setGlobalFlags();
}

describe('DatasourceClientAdapterImpl', () => {
    let adapter: DatasourceClientAdapterImpl;

    beforeEach(() => {
        vi.clearAllMocks();
        resetFlags();
        adapter = new DatasourceClientAdapterImpl();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('testConnection - PostgreSQL', () => {
        it('should return success event when PostgreSQL connection succeeds', async () => {
            const dataSource = createDataSource({
                type: DataSourceType.POSTGRESQL,
                host: 'pg-host',
                port: 5432,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result.dataSourceId).toBe('ds-001');
            expect(result.dataSourceName).toBe('Test DataSource');
            expect(result.dataSourceType).toBe(DataSourceType.POSTGRESQL);
            expect(result.result).toBe(TestConnectionResult.SUCCESS);
            expect(result.databaseVersion).toBe('PostgreSQL 15.2');
            expect(result.message).toContain('成功连接到 PostgreSQL');
            expect(result.errorDetails).toBeUndefined();
            expect(result.timestamp).toBeInstanceOf(Date);
        });

        it('should return failed event when PostgreSQL connection fails', async () => {
            __KNEX_FAIL = true;
            setGlobalFlags();

            const dataSource = createDataSource({
                type: DataSourceType.POSTGRESQL,
                host: 'pg-host',
                port: 5432,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result.result).toBe(TestConnectionResult.FAILED);
            expect(result.message).toContain('连接失败');
            expect(result.message).toContain('knex connection failed');
            expect(result.errorDetails).toBeDefined();
            expect(result.databaseVersion).toBeUndefined();
        });

        it('should handle PostgreSQL version response format with array fallback', async () => {
            __KNEX_RESPONSE_FORMAT = 'array';
            __KNEX_VERSION = 'PostgreSQL 14.0 via array';
            setGlobalFlags();

            const dataSource = createDataSource({
                type: DataSourceType.POSTGRESQL,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result.result).toBe(TestConnectionResult.SUCCESS);
            expect(result.databaseVersion).toBe('PostgreSQL 14.0 via array');
        });

        it('should call knex.destroy() after successful connection', async () => {
            __DESTROY_SPY = vi.fn();
            setGlobalFlags();

            const freshAdapter = new DatasourceClientAdapterImpl();
            const dataSource = createDataSource({
                type: DataSourceType.POSTGRESQL,
            });

            await freshAdapter.testConnection(dataSource);

            expect(__DESTROY_SPY).toHaveBeenCalled();
        });

        it('should call knex.destroy() even when connection fails', async () => {
            __DESTROY_SPY = vi.fn();
            __KNEX_FAIL = true;
            setGlobalFlags();

            const freshAdapter = new DatasourceClientAdapterImpl();
            const dataSource = createDataSource({
                type: DataSourceType.POSTGRESQL,
            });

            await freshAdapter.testConnection(dataSource);

            expect(__DESTROY_SPY).toHaveBeenCalled();
        });
    });

    describe('testConnection - ClickHouse', () => {
        it('should return success event when ClickHouse connection succeeds', async () => {
            const dataSource = createDataSource({
                type: DataSourceType.CLICKHOUSE,
                host: 'ch-host',
                port: 8123,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result.dataSourceId).toBe('ds-001');
            expect(result.dataSourceName).toBe('Test DataSource');
            expect(result.dataSourceType).toBe(DataSourceType.CLICKHOUSE);
            expect(result.result).toBe(TestConnectionResult.SUCCESS);
            expect(result.databaseVersion).toBe('22.3.0');
            expect(result.message).toContain('成功连接到 ClickHouse');
            expect(result.errorDetails).toBeUndefined();
        });

        it('should return failed event when ClickHouse connection fails', async () => {
            __CH_FAIL = true;
            setGlobalFlags();

            const dataSource = createDataSource({
                type: DataSourceType.CLICKHOUSE,
                host: 'ch-host',
                port: 8123,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result.result).toBe(TestConnectionResult.FAILED);
            expect(result.message).toContain('连接失败');
            expect(result.message).toContain('clickhouse connection failed');
            expect(result.errorDetails).toBeDefined();
            expect(result.databaseVersion).toBeUndefined();
        });

        it('should handle ClickHouse empty version response gracefully', async () => {
            __CH_VERSION = ''; // Empty string - falsy, should fallback to 'Unknown'
            setGlobalFlags();

            const dataSource = createDataSource({
                type: DataSourceType.CLICKHOUSE,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result.result).toBe(TestConnectionResult.SUCCESS);
            // Implementation uses `result[0]?.version || 'Unknown'`
            // Empty string is falsy, so it falls back to 'Unknown'
            expect(result.databaseVersion).toBe('Unknown');
        });
    });

    describe('testConnection - MySQL (coverage edge case)', () => {
        it('should return success event when MySQL connection succeeds', async () => {
            // MySQL uses array format: [[{ version: '...' }]]
            __KNEX_RESPONSE_FORMAT = 'array';
            __KNEX_VERSION = '8.0.32';
            setGlobalFlags();

            const freshAdapter = new DatasourceClientAdapterImpl();
            const dataSource = createDataSource({
                type: DataSourceType.MYSQL,
                host: 'mysql-host',
                port: 3306,
            });

            const result = await freshAdapter.testConnection(dataSource);

            expect(result.dataSourceId).toBe('ds-001');
            expect(result.dataSourceName).toBe('Test DataSource');
            expect(result.dataSourceType).toBe(DataSourceType.MYSQL);
            expect(result.result).toBe(TestConnectionResult.SUCCESS);
            expect(result.databaseVersion).toBe('8.0.32');
            expect(result.message).toContain('成功连接到 MySQL');
        });

        it('should return failed event when MySQL connection fails', async () => {
            __KNEX_FAIL = true;
            __KNEX_ERROR_MSG = 'MySQL connection refused';
            setGlobalFlags();

            const freshAdapter = new DatasourceClientAdapterImpl();
            const dataSource = createDataSource({
                type: DataSourceType.MYSQL,
                host: 'mysql-host',
                port: 3306,
            });

            const result = await freshAdapter.testConnection(dataSource);

            expect(result.result).toBe(TestConnectionResult.FAILED);
            expect(result.message).toContain('连接失败');
            expect(result.message).toContain('MySQL connection refused');
            expect(result.errorDetails).toBeDefined();
        });

        it('should handle MySQL with missing version in response (returns Unknown)', async () => {
            // Test empty array response scenario through control flags
            __KNEX_RESPONSE_FORMAT = 'array';
            __KNEX_VERSION = ''; // Empty string - falsy
            setGlobalFlags();

            const freshAdapter = new DatasourceClientAdapterImpl();
            const dataSource = createDataSource({
                type: DataSourceType.MYSQL,
            });

            const result = await freshAdapter.testConnection(dataSource);

            // Implementation uses `mysqlVersion[0]?.[0]?.version || 'Unknown'`
            // Even with empty string, the result[0]?.[0]?.version returns '' which is falsy,
            // so it falls back to 'Unknown'
            expect(result.result).toBe(TestConnectionResult.SUCCESS);
            expect(result.databaseVersion).toBe('Unknown');
        });
    });

    describe('testConnection - Error handling', () => {
        it('should handle non-Error exceptions gracefully (string thrown)', async () => {
            __KNEX_THROW_ON_CREATE = true;
            __KNEX_THROW_NON_ERROR = true;
            setGlobalFlags();

            const freshAdapter = new DatasourceClientAdapterImpl();
            const dataSource = createDataSource({
                type: DataSourceType.POSTGRESQL,
            });

            const result = await freshAdapter.testConnection(dataSource);

            expect(result.result).toBe(TestConnectionResult.FAILED);
            expect(result.message).toContain('连接失败');
            expect(result.errorDetails).toBe('string error');
        });

        it('should default to PostgreSQL type when dataSource.type is undefined', async () => {
            const dataSource = createDataSource({
                type: undefined,
            });

            const result = await adapter.testConnection(dataSource);

            // Should use PostgreSQL path and succeed
            expect(result.result).toBe(TestConnectionResult.SUCCESS);
            expect(result.message).toContain('PostgreSQL');
        });

        it('should include error stack in errorDetails for Error instances', async () => {
            __KNEX_FAIL = true;
            __KNEX_ERROR_MSG = 'ECONNREFUSED';
            setGlobalFlags();

            const dataSource = createDataSource({
                type: DataSourceType.POSTGRESQL,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result.result).toBe(TestConnectionResult.FAILED);
            expect(result.errorDetails).toContain('ECONNREFUSED');
            expect(result.errorDetails).toContain('at Object'); // Stack trace indicator
        });
    });

    describe('TestConnectionEvent structure', () => {
        it('should return properly structured event on success', async () => {
            const dataSource = createDataSource({
                id: 'test-id-123',
                name: 'Production DB',
                type: DataSourceType.POSTGRESQL,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result).toMatchObject({
                dataSourceId: 'test-id-123',
                dataSourceName: 'Production DB',
                dataSourceType: DataSourceType.POSTGRESQL,
                result: TestConnectionResult.SUCCESS,
            });
            expect(result.timestamp).toBeInstanceOf(Date);
            expect(typeof result.databaseVersion).toBe('string');
            expect(typeof result.message).toBe('string');
        });

        it('should return properly structured event on failure', async () => {
            __KNEX_FAIL = true;
            setGlobalFlags();

            const dataSource = createDataSource({
                id: 'test-id-456',
                name: 'Broken DB',
                type: DataSourceType.POSTGRESQL,
            });

            const result = await adapter.testConnection(dataSource);

            expect(result).toMatchObject({
                dataSourceId: 'test-id-456',
                dataSourceName: 'Broken DB',
                dataSourceType: DataSourceType.POSTGRESQL,
                result: TestConnectionResult.FAILED,
            });
            expect(result.timestamp).toBeInstanceOf(Date);
            expect(typeof result.message).toBe('string');
            expect(typeof result.errorDetails).toBe('string');
        });
    });
});

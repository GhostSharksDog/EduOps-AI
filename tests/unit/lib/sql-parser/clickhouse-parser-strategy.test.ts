import { describe, it, expect } from 'vitest';
import { ClickHouseParserStrategy, mapClickHouseDataType } from '@/platform/sql-parser/strategies/ClickHouseParserStrategy';
import { DataType } from '@/shared/enums/data-models/DataType';

describe('ClickHouseParserStrategy', () => {
    const strategy = new ClickHouseParserStrategy();

    describe('Type Mapping', () => {
        describe('Integer Types', () => {
            it('maps UInt8 to NUMBER', () => expect(mapClickHouseDataType('UInt8')).toBe(DataType.NUMBER));
            it('maps UInt16 to NUMBER', () => expect(mapClickHouseDataType('UInt16')).toBe(DataType.NUMBER));
            it('maps UInt32 to NUMBER', () => expect(mapClickHouseDataType('UInt32')).toBe(DataType.NUMBER));
            it('maps UInt64 to NUMBER', () => expect(mapClickHouseDataType('UInt64')).toBe(DataType.NUMBER));
            it('maps UInt128 to NUMBER', () => expect(mapClickHouseDataType('UInt128')).toBe(DataType.NUMBER));
            it('maps UInt256 to NUMBER', () => expect(mapClickHouseDataType('UInt256')).toBe(DataType.NUMBER));
            it('maps Int8 to NUMBER', () => expect(mapClickHouseDataType('Int8')).toBe(DataType.NUMBER));
            it('maps Int16 to NUMBER', () => expect(mapClickHouseDataType('Int16')).toBe(DataType.NUMBER));
            it('maps Int32 to NUMBER', () => expect(mapClickHouseDataType('Int32')).toBe(DataType.NUMBER));
            it('maps Int64 to NUMBER', () => expect(mapClickHouseDataType('Int64')).toBe(DataType.NUMBER));
            it('maps Int128 to NUMBER', () => expect(mapClickHouseDataType('Int128')).toBe(DataType.NUMBER));
            it('maps Int256 to NUMBER', () => expect(mapClickHouseDataType('Int256')).toBe(DataType.NUMBER));
        });

        describe('Float Types', () => {
            it('maps Float32 to NUMBER', () => expect(mapClickHouseDataType('Float32')).toBe(DataType.NUMBER));
            it('maps Float64 to NUMBER', () => expect(mapClickHouseDataType('Float64')).toBe(DataType.NUMBER));
        });

        describe('Decimal Types', () => {
            it('maps Decimal to NUMBER', () => expect(mapClickHouseDataType('Decimal(10, 2)')).toBe(DataType.NUMBER));
            it('maps Decimal32 to NUMBER', () => expect(mapClickHouseDataType('Decimal32(4)')).toBe(DataType.NUMBER));
            it('maps Decimal64 to NUMBER', () => expect(mapClickHouseDataType('Decimal64(8)')).toBe(DataType.NUMBER));
            it('maps Decimal128 to NUMBER', () => expect(mapClickHouseDataType('Decimal128(18)')).toBe(DataType.NUMBER));
            it('maps Decimal256 to NUMBER', () => expect(mapClickHouseDataType('Decimal256(36)')).toBe(DataType.NUMBER));
        });

        describe('String Types', () => {
            it('maps String to STRING', () => expect(mapClickHouseDataType('String')).toBe(DataType.STRING));
            it('maps FixedString to STRING', () => expect(mapClickHouseDataType('FixedString(100)')).toBe(DataType.STRING));
        });

        describe('Date/Time Types', () => {
            it('maps Date to DATE', () => expect(mapClickHouseDataType('Date')).toBe(DataType.DATE));
            it('maps Date32 to DATE', () => expect(mapClickHouseDataType('Date32')).toBe(DataType.DATE));
            it('maps DateTime to DATETIME', () => expect(mapClickHouseDataType('DateTime')).toBe(DataType.DATETIME));
            it('maps DateTime64 to DATETIME', () => expect(mapClickHouseDataType('DateTime64(3)')).toBe(DataType.DATETIME));
            it('maps DateTime with timezone to DATETIME', () => expect(mapClickHouseDataType("DateTime('Asia/Shanghai')")).toBe(DataType.DATETIME));
            it('maps DateTime64 with timezone to DATETIME', () => expect(mapClickHouseDataType("DateTime64(3, 'UTC')")).toBe(DataType.DATETIME));
        });

        describe('Boolean Types', () => {
            it('maps Bool to BOOLEAN', () => expect(mapClickHouseDataType('Bool')).toBe(DataType.BOOLEAN));
            it('maps Boolean to BOOLEAN', () => expect(mapClickHouseDataType('Boolean')).toBe(DataType.BOOLEAN));
        });

        describe('UUID and IP Types', () => {
            it('maps UUID to STRING', () => expect(mapClickHouseDataType('UUID')).toBe(DataType.STRING));
            it('maps IPv4 to STRING', () => expect(mapClickHouseDataType('IPv4')).toBe(DataType.STRING));
            it('maps IPv6 to STRING', () => expect(mapClickHouseDataType('IPv6')).toBe(DataType.STRING));
        });

        describe('Array Types', () => {
            it('maps Array(String) to ARRAY', () => expect(mapClickHouseDataType('Array(String)')).toBe(DataType.ARRAY));
            it('maps Array(Int64) to ARRAY', () => expect(mapClickHouseDataType('Array(Int64)')).toBe(DataType.ARRAY));
            it('maps Array(Array(Int32)) to ARRAY', () => expect(mapClickHouseDataType('Array(Array(Int32))')).toBe(DataType.ARRAY));
        });

        describe('Map and Tuple Types', () => {
            it('maps Map to OBJECT', () => expect(mapClickHouseDataType('Map(String, Int64)')).toBe(DataType.OBJECT));
            it('maps Tuple to OBJECT', () => expect(mapClickHouseDataType('Tuple(name String, age Int32)')).toBe(DataType.OBJECT));
        });

        describe('Nullable Types', () => {
            it('maps Nullable(String) to STRING', () => expect(mapClickHouseDataType('Nullable(String)')).toBe(DataType.STRING));
            it('maps Nullable(Int64) to NUMBER', () => expect(mapClickHouseDataType('Nullable(Int64)')).toBe(DataType.NUMBER));
            it('maps Nullable(DateTime) to DATETIME', () => expect(mapClickHouseDataType('Nullable(DateTime)')).toBe(DataType.DATETIME));
        });

        describe('LowCardinality Types', () => {
            it('maps LowCardinality(String) to STRING', () => expect(mapClickHouseDataType('LowCardinality(String)')).toBe(DataType.STRING));
            it('maps LowCardinality(FixedString(16)) to STRING', () => expect(mapClickHouseDataType('LowCardinality(FixedString(16))')).toBe(DataType.STRING));
        });

        describe('SimpleAggregateFunction Types', () => {
            it('maps SimpleAggregateFunction(sum, Int64) to NUMBER', () => expect(mapClickHouseDataType('SimpleAggregateFunction(sum, Int64)')).toBe(DataType.NUMBER));
        });

        describe('Case Insensitivity', () => {
            it('handles lowercase types', () => expect(mapClickHouseDataType('string')).toBe(DataType.STRING));
            it('handles uppercase types', () => expect(mapClickHouseDataType('STRING')).toBe(DataType.STRING));
        });

        describe('Unknown Types', () => {
            it('maps unknown types to STRING as fallback', () => expect(mapClickHouseDataType('UnknownType')).toBe(DataType.STRING));
            it('handles empty string', () => expect(mapClickHouseDataType('')).toBe(DataType.STRING));
        });
    });

    describe('Basic CREATE TABLE Parsing', () => {
        it('parses simple CREATE TABLE', () => {
            const sql = `CREATE TABLE users (
                id UInt64,
                name String
            ) ENGINE = MergeTree()
            ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('users');
            expect(result.columns).toHaveLength(2);
            expect(result.columns[0].name).toBe('id');
            expect(result.columns[1].name).toBe('name');
        });

        it('parses CREATE TABLE with IF NOT EXISTS', () => {
            const sql = `CREATE TABLE IF NOT EXISTS events (
                event_id UInt64
            ) ENGINE = MergeTree()
            ORDER BY event_id`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('events');
            expect(result.columns).toHaveLength(1);
        });

        it('handles database.table syntax', () => {
            const sql = `CREATE TABLE mydb.users (
                id UInt64
            ) ENGINE = MergeTree()`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('users');
        });
    });

    describe('Column Type Parsing', () => {
        it('parses all integer types', () => {
            const sql = `CREATE TABLE integers (
                u8 UInt8, u16 UInt16, u32 UInt32, u64 UInt64, u128 UInt128, u256 UInt256,
                i8 Int8, i16 Int16, i32 Int32, i64 Int64, i128 Int128, i256 Int256
            ) ENGINE = MergeTree() ORDER BY u64`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(12);
            result.columns.forEach(col => {
                expect(col.mappedDataType).toBe(DataType.NUMBER);
            });
        });

        it('parses string types', () => {
            const sql = `CREATE TABLE strings (
                s String,
                fs FixedString(100)
            ) ENGINE = MergeTree() ORDER BY s`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(2);
            result.columns.forEach(col => {
                expect(col.mappedDataType).toBe(DataType.STRING);
            });
        });

        it('parses date/time types', () => {
            const sql = `CREATE TABLE dates (
                d Date,
                d32 Date32,
                dt DateTime,
                dt64 DateTime64(3)
            ) ENGINE = MergeTree() ORDER BY dt`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(4);
            expect(result.columns[0].mappedDataType).toBe(DataType.DATE);
            expect(result.columns[1].mappedDataType).toBe(DataType.DATE);
            expect(result.columns[2].mappedDataType).toBe(DataType.DATETIME);
            expect(result.columns[3].mappedDataType).toBe(DataType.DATETIME);
        });

        it('parses DateTime with timezone', () => {
            const sql = `CREATE TABLE events (
                created_at DateTime('Asia/Shanghai'),
                updated_at DateTime64(6, 'UTC')
            ) ENGINE = MergeTree() ORDER BY created_at`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(2);
            expect(result.columns[0].mappedDataType).toBe(DataType.DATETIME);
            expect(result.columns[1].mappedDataType).toBe(DataType.DATETIME);
        });

        it('parses boolean types', () => {
            const sql = `CREATE TABLE flags (
                is_active Bool,
                is_deleted Boolean
            ) ENGINE = MergeTree() ORDER BY is_active`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(2);
            result.columns.forEach(col => {
                expect(col.mappedDataType).toBe(DataType.BOOLEAN);
            });
        });

        it('parses Array types', () => {
            const sql = `CREATE TABLE arrays (
                tags Array(String),
                numbers Array(Int64),
                nested Array(Array(UInt32))
            ) ENGINE = MergeTree() ORDER BY tags`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(3);
            result.columns.forEach(col => {
                expect(col.mappedDataType).toBe(DataType.ARRAY);
            });
        });

        it('parses Map types', () => {
            const sql = `CREATE TABLE maps (
                properties Map(String, String),
                counts Map(String, Int64)
            ) ENGINE = MergeTree() ORDER BY properties`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(2);
            result.columns.forEach(col => {
                expect(col.mappedDataType).toBe(DataType.OBJECT);
            });
        });

        it('parses Nullable types', () => {
            const sql = `CREATE TABLE nullables (
                name Nullable(String),
                age Nullable(Int32),
                created Nullable(DateTime)
            ) ENGINE = MergeTree() ORDER BY name`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(3);
            expect(result.columns[0].mappedDataType).toBe(DataType.STRING);
            expect(result.columns[1].mappedDataType).toBe(DataType.NUMBER);
            expect(result.columns[2].mappedDataType).toBe(DataType.DATETIME);
        });
    });

    describe('Comment Parsing', () => {
        it('parses column comments', () => {
            const sql = `CREATE TABLE comments (
                id UInt64 COMMENT 'Primary key',
                name String COMMENT 'User name',
                email String COMMENT 'Email address'
            ) ENGINE = MergeTree() ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.columns[0].description).toBe('Primary key');
            expect(result.columns[1].description).toBe('User name');
            expect(result.columns[2].description).toBe('Email address');
        });

        it('parses table comment', () => {
            const sql = `CREATE TABLE users (
                id UInt64
            ) ENGINE = MergeTree()
            COMMENT 'User information table'`;

            const result = strategy.parse(sql);

            expect(result.tableComment).toBe('User information table');
        });
    });

    describe('Complex Real-World Examples', () => {
        it('parses MergeTree table with ORDER BY', () => {
            const sql = `CREATE TABLE events (
                event_id UInt64,
                event_time DateTime64(3),
                user_id UInt32,
                event_name String,
                properties Map(String, String)
            ) ENGINE = MergeTree()
            PARTITION BY toYYYYMM(event_time)
            ORDER BY (event_time, event_id)`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('events');
            expect(result.columns).toHaveLength(5);
        });

        it('parses ReplicatedMergeTree', () => {
            const sql = `CREATE TABLE replicated_events (
                id UInt64,
                data String
            ) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/events', '1')
            ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('replicated_events');
            expect(result.columns).toHaveLength(2);
        });

        it('parses ReplacingMergeTree', () => {
            const sql = `CREATE TABLE versioned_data (
                id UInt64,
                version UInt64,
                data String
            ) ENGINE = ReplacingMergeTree(version)
            ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('versioned_data');
            expect(result.columns).toHaveLength(3);
        });

        it('parses SummingMergeTree', () => {
            const sql = `CREATE TABLE stats (
                key String,
                value UInt64
            ) ENGINE = SummingMergeTree()
            ORDER BY key`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('stats');
            expect(result.columns).toHaveLength(2);
        });

        it('parses Distributed table', () => {
            const sql = `CREATE TABLE distributed_events (
                event_id UInt64,
                event_data String
            ) ENGINE = Distributed(cluster_name, default, events, rand())`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('distributed_events');
            expect(result.columns).toHaveLength(2);
        });

        it('parses table with PRIMARY KEY', () => {
            const sql = `CREATE TABLE with_pk (
                user_id UInt32,
                session_id UInt64,
                event_time DateTime
            ) ENGINE = MergeTree()
            PRIMARY KEY user_id
            ORDER BY (user_id, session_id)`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('with_pk');
            expect(result.columns).toHaveLength(3);
        });

        it('parses table with TTL', () => {
            const sql = `CREATE TABLE with_ttl (
                id UInt64,
                created_at DateTime,
                data String
            ) ENGINE = MergeTree()
            ORDER BY id
            TTL created_at + INTERVAL 30 DAY`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('with_ttl');
            expect(result.columns).toHaveLength(3);
        });

        it('parses table with SETTINGS', () => {
            const sql = `CREATE TABLE with_settings (
                id UInt64,
                data String
            ) ENGINE = MergeTree()
            ORDER BY id
            SETTINGS index_granularity = 8192`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('with_settings');
            expect(result.columns).toHaveLength(2);
        });

        it('parses Materialized View', () => {
            const sql = `CREATE MATERIALIZED VIEW mv_events (
                event_date Date,
                event_count UInt64
            ) ENGINE = SummingMergeTree()
            ORDER BY event_date
            AS SELECT toDate(event_time) as event_date, count() as event_count
               FROM events
               GROUP BY event_date`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('mv_events');
            expect(result.columns).toHaveLength(2);
        });
    });

    describe('Edge Cases', () => {
        it('handles multiline column definitions', () => {
            const sql = `CREATE TABLE multiline (
                id          UInt64,
                name        String,
                description String,
                created_at  DateTime
            ) ENGINE = MergeTree() ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(4);
        });

        it('handles trailing comma in column list', () => {
            const sql = `CREATE TABLE trailing (
                id UInt64,
                name String,
            ) ENGINE = MergeTree() ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(2);
        });

        it('handles single column table', () => {
            const sql = `CREATE TABLE single (
                id UInt64
            ) ENGINE = MergeTree() ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(1);
        });

        it('handles quoted identifiers with backticks', () => {
            const sql = `CREATE TABLE \`my-table\` (
                \`column-name\` String
            ) ENGINE = MergeTree()`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('my-table');
            expect(result.columns[0].name).toBe('column-name');
        });

        it('handles quoted identifiers with double quotes', () => {
            const sql = `CREATE TABLE "my-table" (
                "column-name" String
            ) ENGINE = MergeTree()`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('my-table');
            expect(result.columns[0].name).toBe('column-name');
        });

        it('handles SQL comments', () => {
            const sql = `-- This is a comment
            CREATE TABLE commented (
                id UInt64, -- primary key
                name String /* inline comment */
            ) ENGINE = MergeTree()`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('commented');
            expect(result.columns).toHaveLength(2);
        });

        it('handles extra whitespace', () => {
            const sql = `CREATE    TABLE    extra_whitespace   (
                id    UInt64,
                name    String
            )    ENGINE    =    MergeTree()`;

            const result = strategy.parse(sql);

            expect(result.tableName).toBe('extra_whitespace');
            expect(result.columns).toHaveLength(2);
        });

        it('handles DEFAULT keyword', () => {
            const sql = `CREATE TABLE defaults (
                id UInt64,
                status String DEFAULT 'active',
                count Int32 DEFAULT 0
            ) ENGINE = MergeTree() ORDER BY id`;

            const result = strategy.parse(sql);

            expect(result.columns).toHaveLength(3);
            expect(result.columns[1].name).toBe('status');
            expect(result.columns[2].name).toBe('count');
        });
    });

    describe('Validation', () => {
        it('validates correct SQL', () => {
            const sql = `CREATE TABLE valid (
                id UInt64
            ) ENGINE = MergeTree()`;

            const errors = strategy.validate(sql);

            expect(errors).toHaveLength(0);
        });

        it('returns errors for empty SQL', () => {
            const errors = strategy.validate('');

            expect(errors.length).toBeGreaterThan(0);
        });

        it('returns errors for SQL without CREATE', () => {
            const errors = strategy.validate('SELECT * FROM users');

            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('Dialect Property', () => {
        it('returns clickhouse as dialect', () => {
            expect(strategy.dialect).toBe('clickhouse');
        });
    });
});

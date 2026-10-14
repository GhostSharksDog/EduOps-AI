import { describe, it, expect } from 'vitest';
import { TagValueType } from '@/shared/enums/tag/TagValueType';
import {
    generateTargetTableDDL,
    serializeDDLResult,
    deserializeDDLResult,
} from '@/platform/ddl/generateTargetTableDDL';
import {
    getClickHouseColumnType,
    getOrderByClause,
    TAG_VALUE_TYPE_TO_CLICKHOUSE,
} from '@/platform/ddl/tagValueTypeMappings';
describe('tagValueTypeMappings', () => {
    it('should map STRING to String', () => {
        expect(getClickHouseColumnType(TagValueType.STRING)).toBe('String');
    });

    it('should map NUMBER to Float64', () => {
        expect(getClickHouseColumnType(TagValueType.NUMBER)).toBe('Float64');
    });

    it('should map BOOLEAN to UInt8', () => {
        expect(getClickHouseColumnType(TagValueType.BOOLEAN)).toBe('UInt8');
    });

    it('should map DATE to Date', () => {
        expect(getClickHouseColumnType(TagValueType.DATE)).toBe('Date');
    });

    it('should map DATETIME to DateTime', () => {
        expect(getClickHouseColumnType(TagValueType.DATETIME)).toBe('DateTime');
    });

    it('should have mapping for every TagValueType', () => {
        const allTypes = Object.values(TagValueType);
        for (const t of allTypes) {
            expect(TAG_VALUE_TYPE_TO_CLICKHOUSE[t]).toBeDefined()
        }
    });
});

describe('generateTargetTableDDL', () => {
    const baseOptions = {
        tableName: 'test.target_table',
        entityTypeCode: 'USER',
        entityTypeId: 'user-type-id',
    }

    it('should generate DDL with STRING tag_value', () => {
        const result = generateTargetTableDDL({
            ...baseOptions,
            tagValueType: TagValueType.STRING,
        });

        expect(result.sql).toContain('CREATE TABLE IF NOT EXISTS test.target_table');
        expect(result.sql).toContain('entity_id String');
        expect(result.sql).toContain("entity_type_id LowCardinality(String) DEFAULT 'user-type-id'");
        expect(result.sql).toContain('tag_value String');
        expect(result.sql).toContain('update_time DateTime DEFAULT now()');
        expect(result.sql).toContain('ORDER BY (entity_id)');
        expect(result.sql).toContain('ENGINE = MergeTree()');
        expect(result.generatedBy).toBe('AUTO');
        expect(result.tagValueType).toBe(TagValueType.STRING)
    });

    it('should generate DDL with NUMBER tag_value as Float64', () => {
        const result = generateTargetTableDDL({
            ...baseOptions,
            tagValueType: TagValueType.NUMBER,
        })

        expect(result.sql).toContain('tag_value Float64');
        expect(result.sql).toContain('ORDER BY (entity_id)');
    });

    it('should generate DDL with BOOLEAN tag_value as UInt8', () => {
        const result = generateTargetTableDDL({
            ...baseOptions,
            tagValueType: TagValueType.BOOLEAN,
        })

        expect(result.sql).toContain('tag_value UInt8');
    })

    it('should generate DDL with DATE tag_value with composite ORDER BY', () => {
        const result = generateTargetTableDDL({
            ...baseOptions,
            tagValueType: TagValueType.DATE,
        })

        expect(result.sql).toContain('tag_value Date');
        expect(result.sql).toContain('ORDER BY (entity_id, tag_value)');
    })

    it('should generate DDL with DATETIME tag_value with composite ORDER BY', () => {
        const result = generateTargetTableDDL({
            ...baseOptions,
            tagValueType: TagValueType.DATETIME,
        })

        expect(result.sql).toContain('tag_value DateTime');
        expect(result.sql).toContain('ORDER BY (entity_id, tag_value)');
    });

    it('should include correct entityTypeCode in DEFAULT', () => {
        const result = generateTargetTableDDL({
            tableName: 'my_table',
            entityTypeCode: 'DEVICE',
            entityTypeId: 'device-type-id',
            tagValueType: TagValueType.STRING,
        })

        expect(result.sql).toContain("entity_type_id LowCardinality(String) DEFAULT 'device-type-id'");
    });

    it('should return 4 columns in columns array', () => {
        const result = generateTargetTableDDL({
            ...baseOptions,
            tagValueType: TagValueType.STRING,
        })

        expect(result.columns).toHaveLength(4)
        expect(result.columns[0].name).toBe('entity_id');
        expect(result.columns[1].name).toBe('entity_type_id');
        expect(result.columns[2].name).toBe('tag_value');
        expect(result.columns[3].name).toBe('update_time');
    });
});

describe('serializeDDLResult / deserializeDDLResult', () => {
    it('should round-trip a DDLGenerateResult', () => {
        const result = generateTargetTableDDL({
            tableName: 'test_table',
            entityTypeCode: 'USER',
            entityTypeId: 'user-type-id',
            tagValueType: TagValueType.NUMBER,
        })

        const json = serializeDDLResult(result);
        const parsed = deserializeDDLResult(json);

        expect(parsed).not.toBeNull();
        expect(parsed!.sql).toBe(result.sql);
        expect(parsed!.generatedBy).toBe('AUTO');
        expect(parsed!.tagValueType).toBe(TagValueType.NUMBER);
        expect(parsed!.columns).toEqual(result.columns);
    });

    it('should return null for non-JSON string (legacy data)', () => {
        const legacySQL = 'CREATE TABLE foo (id String) ENGINE = MergeTree() ORDER BY id;';
        const result = deserializeDDLResult(legacySQL);
        expect(result).toBeNull();
    });

    it('should return null for JSON without expected fields', () => {
        const result = deserializeDDLResult('{"foo": "bar"}');
        expect(result).toBeNull();
    });
});

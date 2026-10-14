import { describe, it, expect } from 'vitest';
import { dataSourceSchema, DataSourceVO } from '@/modules/data/contracts/schemas/response/datasource/dataSourceSchema';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testEnumValidation,
  testUUIDValidation,
  testISODateTimeValidation,
  testBooleanValidation,
} from '../../../../helpers/schema-test-utils';

describe('dataSourceSchema', () => {
  const validInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Database',
    type: DataSourceType.POSTGRESQL,
    host: 'db.example.com',
    port: 5432,
    databaseName: 'testdb',
    username: 'admin',
    status: DataSourceStatus.ACTIVE,
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Test database connection',
    feature: { enabled: true },
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    deleteTime: undefined,
    createdBy: '123e4567-e89b-12d3-a456-426614174002',
    updatedBy: '123e4567-e89b-12d3-a456-426614174003',
    deletedBy: null,
  };

  describe('schema structure', () => {
    testStrictObject(dataSourceSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(
      dataSourceSchema,
      [
        'id',
        'name',
        'type',
        'host',
        'port',
        'databaseName',
        'username',
        'status',
        // ownedBy is now optional in the schema
        'isDeleted',
        'createTime',
      ],
      validInput
    );
  });

  describe('optional fields', () => {
    testOptionalFields(
      dataSourceSchema,
      ['description', 'feature', 'updateTime', 'deleteTime', 'createdBy', 'updatedBy', 'deletedBy'],
      validInput
    );
  });

  describe('id field', () => {
    testUUIDValidation(dataSourceSchema, 'id', validInput);
  });

  describe('name field', () => {
    it('accepts non-empty name', () => {
      const input = { ...validInput, name: 'Test' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from name', () => {
      const input = { ...validInput, name: '  Test Database  ' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Database');
      }
    });

    it('rejects non-string name', () => {
      const input = { ...validInput, name: 123 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('type field', () => {
    testEnumValidation(dataSourceSchema, 'type', Object.values(DataSourceType), validInput);
  });

  describe('host field', () => {
    it('accepts valid IPv4 address', () => {
      const input = { ...validInput, host: '192.168.1.1' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts valid domain name with TLD', () => {
      const input = { ...validInput, host: 'db.example.com' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts localhost', () => {
      const input = { ...validInput, host: 'localhost' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from host', () => {
      const input = { ...validInput, host: '  db.example.com  ' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.host).toBe('db.example.com');
      }
    });

    it('rejects non-string host', () => {
      const input = { ...validInput, host: 123 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('port field', () => {
    it('accepts valid integer port', () => {
      const input = { ...validInput, port: 5432 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts port 1', () => {
      const input = { ...validInput, port: 1 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts port 65535', () => {
      const input = { ...validInput, port: 65535 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects float port', () => {
      const input = { ...validInput, port: 80.5 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric port', () => {
      const input = { ...validInput, port: '5432' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('databaseName field', () => {
    it('accepts non-empty databaseName', () => {
      const input = { ...validInput, databaseName: 'test' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from databaseName', () => {
      const input = { ...validInput, databaseName: '  testdb  ' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.databaseName).toBe('testdb');
      }
    });

    it('rejects non-string databaseName', () => {
      const input = { ...validInput, databaseName: 123 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('username field', () => {
    it('accepts non-empty username', () => {
      const input = { ...validInput, username: 'admin' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from username', () => {
      const input = { ...validInput, username: '  admin  ' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('admin');
      }
    });

    it('rejects non-string username', () => {
      const input = { ...validInput, username: 123 };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('status field', () => {
    testEnumValidation(dataSourceSchema, 'status', Object.values(DataSourceStatus), validInput);
  });

  describe('ownedBy field', () => {
    testUUIDValidation(dataSourceSchema, 'ownedBy', validInput);
  });

  describe('description field', () => {
    it('accepts description when provided', () => {
      const input = { ...validInput, description: 'A test database' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts empty string description', () => {
      const input = { ...validInput, description: '' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined description', () => {
      const { description: _, ...input } = validInput;
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from description', () => {
      const input = { ...validInput, description: '  Test description  ' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Test description');
      }
    });
  });

  describe('feature field', () => {
    it('accepts feature object when provided', () => {
      const input = { ...validInput, feature: { enabled: true, timeout: 3000 } };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null feature', () => {
      const input = { ...validInput, feature: null };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined feature', () => {
      const { feature: _, ...input } = validInput;
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts complex feature JSON', () => {
      const input = {
        ...validInput,
        feature: {
          enabled: true,
          timeout: 5000,
          pool: { min: 2, max: 10 },
          ssl: { enabled: true, verify: false },
        },
      };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('isDeleted field', () => {
    testBooleanValidation(dataSourceSchema, 'isDeleted', validInput);
  });

  describe('createTime field', () => {
    testISODateTimeValidation(dataSourceSchema, 'createTime', validInput);
  });

  describe('updateTime field', () => {
    it('accepts updateTime when provided', () => {
      const input = { ...validInput, updateTime: '2024-12-31T23:59:59.999Z' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined updateTime', () => {
      const { updateTime: _, ...input } = validInput;
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid updateTime format', () => {
      const input = { ...validInput, updateTime: 'not-a-datetime' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('deleteTime field', () => {
    it('accepts deleteTime when provided', () => {
      const input = { ...validInput, deleteTime: '2024-12-31T23:59:59.999Z' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined deleteTime', () => {
      const { deleteTime: _, ...input } = validInput;
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid deleteTime format', () => {
      const input = { ...validInput, deleteTime: 'not-a-datetime' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('createdBy field', () => {
    it('accepts createdBy UUID when provided', () => {
      const input = { ...validInput, createdBy: '123e4567-e89b-12d3-a456-426614174099' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined createdBy', () => {
      const { createdBy: _, ...input } = validInput;
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid createdBy UUID', () => {
      const input = { ...validInput, createdBy: 'not-a-uuid' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updatedBy field', () => {
    it('accepts updatedBy UUID when provided', () => {
      const input = { ...validInput, updatedBy: '123e4567-e89b-12d3-a456-426614174099' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined updatedBy', () => {
      const { updatedBy: _, ...input } = validInput;
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid updatedBy UUID', () => {
      const input = { ...validInput, updatedBy: 'not-a-uuid' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('deletedBy field', () => {
    it('accepts deletedBy UUID when provided', () => {
      const input = { ...validInput, deletedBy: '123e4567-e89b-12d3-a456-426614174099' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null deletedBy', () => {
      const input = { ...validInput, deletedBy: null };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined deletedBy', () => {
      const { deletedBy: _, ...input } = validInput;
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid deletedBy UUID', () => {
      const input = { ...validInput, deletedBy: 'not-a-uuid' };
      const result = dataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: dataSourceSchema,
      validCases: [
        {
          input: validInput,
          description: 'all fields populated',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Minimal DB',
            type: DataSourceType.MYSQL,
            host: 'localhost',
            port: 3306,
            databaseName: 'test',
            username: 'root',
            status: DataSourceStatus.DISABLED,
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-01-01T00:00:00.000Z',
          },
          description: 'minimal required fields',
        },
        {
          input: {
            ...validInput,
            description: undefined,
            feature: undefined,
            updateTime: undefined,
            deleteTime: undefined,
            createdBy: undefined,
            updatedBy: undefined,
            deletedBy: null,
          },
          description: 'only required fields with null deletedBy',
        },
        {
          input: {
            ...validInput,
            type: DataSourceType.CLICKHOUSE,
            status: DataSourceStatus.ACTIVE,
            isDeleted: true,
            deleteTime: '2024-12-31T23:59:59.999Z',
            deletedBy: '123e4567-e89b-12d3-a456-426614174099',
          },
          description: 'deleted data source',
        },
      ],
      invalidCases: [
        {
          input: {
            name: 'Test',
            type: DataSourceType.POSTGRESQL,
            host: 'db.example.com',
            port: 5432,
            databaseName: 'test',
            username: 'admin',
            status: DataSourceStatus.ACTIVE,
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
          },
          description: 'missing id field',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            type: DataSourceType.POSTGRESQL,
            host: 'db.example.com',
            port: 5432,
            databaseName: 'test',
            username: 'admin',
            status: DataSourceStatus.ACTIVE,
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
          },
          description: 'missing name field',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test',
            host: 'db.example.com',
            port: 5432,
            databaseName: 'test',
            username: 'admin',
            status: DataSourceStatus.ACTIVE,
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
          },
          description: 'missing type field',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test',
            type: DataSourceType.POSTGRESQL,
            port: 5432,
            databaseName: 'test',
            username: 'admin',
            status: DataSourceStatus.ACTIVE,
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
          },
          description: 'missing host field',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test',
            type: DataSourceType.POSTGRESQL,
            host: 'db.example.com',
            databaseName: 'test',
            username: 'admin',
            status: DataSourceStatus.ACTIVE,
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
          },
          description: 'missing port field',
        },
        {
          input: { ...validInput, port: 'invalid' },
          description: 'port as string instead of number',
        },
        {
          input: { ...validInput, type: 'INVALID_TYPE' },
          description: 'invalid type enum',
        },
        {
          input: { ...validInput, status: 'INVALID_STATUS' },
          description: 'invalid status enum',
        },
        {
          input: { ...validInput, id: 'not-a-uuid' },
          description: 'invalid id UUID format',
        },
        {
          input: { ...validInput, createTime: 'not-a-datetime' },
          description: 'invalid createTime format',
        },
        {
          input: { ...validInput, isDeleted: 'true' },
          description: 'isDeleted as string instead of boolean',
        },
      ],
    });
  });
});

import { describe, it, expect } from 'vitest';
import { createDataSourceSchema } from '@/modules/data/contracts/schemas/request/datasource/createDataSourceSchema';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testDefaultValues,
  testStringConstraints,
  testEnumValidation,
  testNumberConstraints,
} from '../../../../helpers/schema-test-utils';

describe('createDataSourceSchema', () => {
  const validInput = {
    name: 'Test Database',
    type: DataSourceType.POSTGRESQL,
    host: 'db.example.com',
    port: 5432,
    databaseName: 'testdb',
    username: 'admin',
    password: 'secret123',
    status: DataSourceStatus.DISABLED,
    description: 'Test database connection',
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(createDataSourceSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(
      createDataSourceSchema,
      ['name', 'type', 'host', 'port', 'databaseName', 'username', 'password'],
      validInput
    );
  });

  describe('optional fields', () => {
    testOptionalFields(createDataSourceSchema, ['description', 'status', 'feature'], validInput);
  });

  describe('name field', () => {
    testStringConstraints(createDataSourceSchema, 'name', { ...validInput, name: 'Test' }, {
      minLength: 1,
      maxLength: 255,
      allowEmpty: false,
    });
  });

  describe('type field', () => {
    testEnumValidation(createDataSourceSchema, 'type', Object.values(DataSourceType), validInput);
  });

  describe('host field', () => {
    testStringConstraints(createDataSourceSchema, 'host', { ...validInput, host: 'db.example.com' }, {
      minLength: 1,
      allowEmpty: false,
    });

    it('accepts valid IPv4 address', () => {
      const input = { ...validInput, host: '192.168.1.1' };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts valid domain name with TLD', () => {
      const input = { ...validInput, host: 'db.example.com' };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid host format (no TLD)', () => {
      const input = { ...validInput, host: 'localhost' };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid host format', () => {
      const input = { ...validInput, host: 'invalid host!' };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('port field', () => {
    testNumberConstraints(createDataSourceSchema, 'port', { ...validInput, port: 80 }, {
      min: 1,
      max: 65535,
      isInteger: true,
    });

    it('accepts port 1', () => {
      const input = { ...validInput, port: 1 };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts port 65535', () => {
      const input = { ...validInput, port: 65535 };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects port 0', () => {
      const input = { ...validInput, port: 0 };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects port > 65535', () => {
      const input = { ...validInput, port: 65536 };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects negative port', () => {
      const input = { ...validInput, port: -1 };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects float port', () => {
      const input = { ...validInput, port: 80.5 };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('databaseName field', () => {
    testStringConstraints(createDataSourceSchema, 'databaseName', { ...validInput, databaseName: 'test' }, {
      minLength: 1,
      maxLength: 255,
      allowEmpty: false,
    });
  });

  describe('username field', () => {
    testStringConstraints(createDataSourceSchema, 'username', { ...validInput, username: 'admin' }, {
      minLength: 1,
      maxLength: 255,
      allowEmpty: false,
    });
  });

  describe('password field', () => {
    testStringConstraints(createDataSourceSchema, 'password', { ...validInput, password: 'secret' }, {
      minLength: 1,
      maxLength: 255,
      allowEmpty: false,
    });

    it('does NOT trim whitespace from password', () => {
      const input = { ...validInput, password: '  secret  ' };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('  secret  ');
      }
    });
  });

  describe('status field', () => {
    testEnumValidation(createDataSourceSchema, 'status', Object.values(DataSourceStatus), validInput);

    it('is optional with default DISABLED', () => {
      const input = {
        name: 'Test',
        type: DataSourceType.POSTGRESQL,
        host: 'db.example.com',
        port: 5432,
        databaseName: 'test',
        username: 'admin',
        password: 'secret',
      };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(DataSourceStatus.DISABLED);
      }
    });
  });

  describe('default values', () => {
    testDefaultValues(
      createDataSourceSchema,
      { status: DataSourceStatus.DISABLED },
      {
        name: 'Test',
        type: DataSourceType.POSTGRESQL,
        host: 'db.example.com',
        port: 5432,
        databaseName: 'test',
        username: 'admin',
        password: 'secret',
      }
    );
  });

  // description field is optional string - no constraints to test


  describe('feature field', () => {
    it('accepts valid feature object', () => {
      const input = { ...validInput, feature: { enabled: true } };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing feature (optional)', () => {
      const input = {
        name: 'Test',
        type: DataSourceType.POSTGRESQL,
        host: 'db.example.com',
        port: 5432,
        databaseName: 'test',
        username: 'admin',
        password: 'secret',
      };
      const result = createDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: createDataSourceSchema,
      validCases: [
        {
          input: {
            name: 'Minimal DB',
            type: DataSourceType.MYSQL,
            host: 'db.example.org',
            port: 3306,
            databaseName: 'mydb',
            username: 'root',
            password: 'password',
          },
          description: 'minimal required fields',
        },
        {
          input: validInput,
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: {
            type: DataSourceType.POSTGRESQL,
            host: 'db.example.com',
            port: 5432,
            databaseName: 'test',
            username: 'admin',
            password: 'secret',
          },
          description: 'missing name',
        },
        {
          input: {
            name: 'Test',
            host: 'db.example.com',
            port: 5432,
            databaseName: 'test',
            username: 'admin',
            password: 'secret',
          },
          description: 'missing type',
        },
        {
          input: { ...validInput, port: 0 },
          description: 'invalid port',
        },
        {
          input: { ...validInput, host: 'localhost' },
          description: 'invalid host format (no TLD)',
        },
        {
          input: { ...validInput, host: 'invalid host!' },
          description: 'invalid host format',
        },
      ],
    });
  });
});

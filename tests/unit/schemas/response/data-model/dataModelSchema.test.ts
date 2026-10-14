import { describe, it, expect } from 'vitest';
import { dataModelSchema } from '@/modules/data/contracts/schemas/response/data-model/dataModelSchema';
import { DataModelStatus } from '@/shared/enums/data-models/DataModelStatus';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';
import { DataType } from '@/shared/enums/data-models/DataType';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testStringConstraints,
  testEnumValidation,
  testUUIDValidation,
  testISODateTimeValidation,
  testBooleanValidation,
  testArrayValidation,
} from '../../../../helpers/schema-test-utils';

describe('dataModelSchema', () => {
  const validDatasourceInput = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test DataSource',
    type: DataSourceType.MYSQL,
    host: 'localhost',
    port: 3306,
    databaseName: 'test_db',
    username: 'root',
    status: DataSourceStatus.ACTIVE,
    ownedBy: '123e4567-e89b-12d3-a456-426614174002',
    description: 'Test data source',
    feature: { enabled: true },
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    deleteTime: undefined,
    createdBy: '123e4567-e89b-12d3-a456-426614174003',
    updatedBy: '123e4567-e89b-12d3-a456-426614174004',
    deletedBy: undefined,
  };

  const validColumnInput = {
    id: '123e4567-e89b-12d3-a456-426614174010',
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    name: 'test_column',
    dataType: DataType.STRING,
    orderIndex: 0,
    isNullable: true,
    isPrimaryKey: false,
    feature: null,
  };

  const validDataModelInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    deleteTime: undefined,
    createdBy: '123e4567-e89b-12d3-a456-426614174002',
    updatedBy: '123e4567-e89b-12d3-a456-426614174003',
    deletedBy: undefined,
    description: 'A test data model',
    feature: { enabled: true },
    name: 'Test DataModel',
    datasource: validDatasourceInput,
    tableName: 'test_table',
    status: DataModelStatus.ACTIVE,
    columns: [validColumnInput],
  };

  describe('schema structure', () => {
    testStrictObject(dataModelSchema, validDataModelInput);
  });

  describe('base schema fields', () => {
    describe('id field', () => {
      testUUIDValidation(dataModelSchema, 'id', validDataModelInput);
    });

    describe('ownedBy field', () => {
      testUUIDValidation(dataModelSchema, 'ownedBy', validDataModelInput);
    });

    describe('isDeleted field', () => {
      testBooleanValidation(dataModelSchema, 'isDeleted', validDataModelInput);
    });

    describe('createTime field', () => {
      testISODateTimeValidation(dataModelSchema, 'createTime', validDataModelInput);
    });

    describe('updateTime field', () => {
      testISODateTimeValidation(dataModelSchema, 'updateTime', validDataModelInput);
    });

    describe('createdBy field', () => {
      testUUIDValidation(dataModelSchema, 'createdBy', validDataModelInput);
    });

    describe('updatedBy field', () => {
      testUUIDValidation(dataModelSchema, 'updatedBy', validDataModelInput);
    });
  });

  describe('extensible base schema fields', () => {
    describe('description field', () => {
      testStringConstraints(
        dataModelSchema,
        'description',
        { ...validDataModelInput, description: 'Test description' },
        { allowEmpty: true }
      );

      it('trims whitespace from description', () => {
        const input = { ...validDataModelInput, description: '  Test description  ' };
        const result = dataModelSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBe('Test description');
        }
      });
    });

    describe('feature field', () => {
      it('accepts valid feature object', () => {
        const input = { ...validDataModelInput, feature: { enabled: true } };
        const result = dataModelSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts null feature', () => {
        const input = { ...validDataModelInput, feature: null };
        const result = dataModelSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('name field', () => {
    testRequiredFields(dataModelSchema, ['name'], validDataModelInput);

    testStringConstraints(dataModelSchema, 'name', validDataModelInput, {
      minLength: 1,
      allowEmpty: false,
    });

    it('trims whitespace from name', () => {
      const input = { ...validDataModelInput, name: '  Test DataModel  ' };
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test DataModel');
      }
    });
  });

  describe('description field (model-specific)', () => {
    testOptionalFields(
      dataModelSchema,
      ['description'],
      validDataModelInput
    );

    testStringConstraints(
      dataModelSchema,
      'description',
      { ...validDataModelInput, description: 'Model description' },
      { allowEmpty: true }
    );
  });

  describe('datasource field', () => {
    it('accepts valid datasource object', () => {
      const input = { ...validDataModelInput, datasource: validDatasourceInput };
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing datasource', () => {
      const { datasource, ...input } = validDataModelInput;
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid datasource', () => {
      const input = { ...validDataModelInput, datasource: { invalid: 'data' } };
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('tableName field', () => {
    testOptionalFields(
      dataModelSchema,
      ['tableName'],
      validDataModelInput
    );

    testStringConstraints(
      dataModelSchema,
      'tableName',
      { ...validDataModelInput, tableName: 'test_table' },
      { allowEmpty: true }
    );

    it('trims whitespace from tableName', () => {
      const input = { ...validDataModelInput, tableName: '  test_table  ' };
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tableName).toBe('test_table');
      }
    });
  });

  describe('status field', () => {
    testRequiredFields(dataModelSchema, ['status'], validDataModelInput);
    testEnumValidation(dataModelSchema, 'status', Object.values(DataModelStatus), validDataModelInput);
  });

  describe('columns field', () => {
    testOptionalFields(
      dataModelSchema,
      ['columns'],
      validDataModelInput
    );

    testArrayValidation(dataModelSchema, 'columns', validDataModelInput);

    it('accepts empty columns array', () => {
      const input = { ...validDataModelInput, columns: [] };
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts columns array with valid column objects', () => {
      const input = { ...validDataModelInput, columns: [validColumnInput] };
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('applies default value for columns', () => {
      const { columns, ...input } = validDataModelInput;
      const result = dataModelSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.columns).toEqual([]);
      }
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: dataModelSchema,
      validCases: [
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
            name: 'Minimal Model',
            datasource: validDatasourceInput,
            status: DataModelStatus.DRAFT,
            columns: [],
            feature: null,
          },
          description: 'minimal required fields',
        },
        {
          input: validDataModelInput,
          description: 'all fields populated',
        },
        {
          input: {
            ...validDataModelInput,
            status: DataModelStatus.INACTIVE,
          },
          description: 'inactive model',
        },
      ],
      invalidCases: [
        {
          input: { datasource: validDatasourceInput, status: DataModelStatus.ACTIVE },
          description: 'missing name',
        },
        {
          input: { name: 'Model', status: DataModelStatus.ACTIVE },
          description: 'missing datasource',
        },
        {
          input: { name: 'Model', datasource: validDatasourceInput },
          description: 'missing status',
        },
        {
          input: {
            name: 'Model',
            datasource: validDatasourceInput,
            status: 'INVALID_STATUS',
          },
          description: 'invalid status enum value',
        },
      ],
    });
  });
});

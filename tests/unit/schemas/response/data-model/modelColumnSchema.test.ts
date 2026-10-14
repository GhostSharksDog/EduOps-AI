import { describe, it, expect } from 'vitest';
import { modelColumnSchema } from '@/modules/data/contracts/schemas/response/data-model/modelColumnSchema';
import { DataType } from '@/shared/enums/data-models/DataType';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testStringConstraints,
  testEnumValidation,
  testNumberConstraints,
  testBooleanValidation,
  testUUIDValidation,
  testISODateTimeValidation,
} from '../../../../helpers/schema-test-utils';

describe('modelColumnSchema', () => {
  const validColumnInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    modelId: '123e4567-e89b-12d3-a456-426614174002',
    name: 'test_column',
    displayName: 'Test Column',
    dataType: DataType.STRING,
    length: 255,
    precision: 10,
    scale: 2,
    defaultValue: 'default',
    description: 'Column description',
    orderIndex: 0,
    isNullable: true,
    isPrimaryKey: false,
    feature: { enabled: true },
  };

  // Valid input with isPrimaryKey-compatible isNullable value (false)
  const validColumnInputPK = {
    ...validColumnInput,
    isPrimaryKey: false,
    isNullable: false,
  };

  describe('schema structure', () => {
    testStrictObject(modelColumnSchema, validColumnInput);
  });

  describe('base schema fields', () => {
    describe('id field', () => {
      testUUIDValidation(modelColumnSchema, 'id', validColumnInput);
    });

    describe('ownedBy field', () => {
      testUUIDValidation(modelColumnSchema, 'ownedBy', validColumnInput);
    });

    describe('isDeleted field', () => {
      testBooleanValidation(modelColumnSchema, 'isDeleted', validColumnInput);
    });

    describe('createTime field', () => {
      testISODateTimeValidation(modelColumnSchema, 'createTime', validColumnInput);
    });

    describe('updateTime field', () => {
      it('accepts valid ISO datetime for updateTime', () => {
        const input = { ...validColumnInput, updateTime: '2024-12-31T23:59:59.999Z' };
        const result = modelColumnSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts missing updateTime (optional)', () => {
        const { updateTime, ...input } = validColumnInput;
        const result = modelColumnSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('modelId field', () => {
    it('accepts valid UUID for modelId', () => {
      const input = { ...validColumnInput, modelId: '123e4567-e89b-12d3-a456-426614174000' };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing modelId (optional)', () => {
      const { modelId, ...input } = validColumnInput;
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('name field', () => {
    testRequiredFields(modelColumnSchema, ['name'], validColumnInput);

    // Note: schema uses z.string().trim() without min(1), so empty strings pass validation after trimming
    it('trims whitespace from name', () => {
      const input = { ...validColumnInput, name: '  test_column  ' };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test_column');
      }
    });
  });

  describe('displayName field', () => {
    testStringConstraints(
      modelColumnSchema,
      'displayName',
      { ...validColumnInput, displayName: 'Test Column' },
      { allowEmpty: true }
    );

    it('trims whitespace from displayName', () => {
      const input = { ...validColumnInput, displayName: '  Test Column  ' };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBe('Test Column');
      }
    });
  });

  describe('dataType field', () => {
    testRequiredFields(modelColumnSchema, ['dataType'], validColumnInput);
    testEnumValidation(modelColumnSchema, 'dataType', Object.values(DataType), validColumnInput);
  });

  describe('length field', () => {
    // Note: schema uses z.int().optional() without min constraint
    testNumberConstraints(modelColumnSchema, 'length', validColumnInput, {
      isInteger: true,
    });

    it('accepts missing length (optional)', () => {
      const { length, ...input } = validColumnInput;
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('precision field', () => {
    // Note: schema uses z.int().optional() without min constraint
    testNumberConstraints(modelColumnSchema, 'precision', validColumnInput, {
      isInteger: true,
    });

    it('accepts missing precision (optional)', () => {
      const { precision, ...input } = validColumnInput;
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('scale field', () => {
    // Note: schema uses z.int().optional() without min constraint
    testNumberConstraints(modelColumnSchema, 'scale', validColumnInput, {
      isInteger: true,
    });

    it('accepts missing scale (optional)', () => {
      const { scale, ...input } = validColumnInput;
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('defaultValue field', () => {
    it('accepts string defaultValue', () => {
      const input = { ...validColumnInput, defaultValue: 'default_value' };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts number defaultValue', () => {
      const input = { ...validColumnInput, defaultValue: 0 };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null defaultValue', () => {
      const input = { ...validColumnInput, defaultValue: null };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing defaultValue (optional)', () => {
      const { defaultValue, ...input } = validColumnInput;
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('description field', () => {
    testStringConstraints(
      modelColumnSchema,
      'description',
      { ...validColumnInput, description: 'Column description' },
      { allowEmpty: true }
    );

    it('trims whitespace from description', () => {
      const input = { ...validColumnInput, description: '  Column description  ' };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Column description');
      }
    });
  });

  describe('orderIndex field', () => {
    testRequiredFields(modelColumnSchema, ['orderIndex'], validColumnInput);
    // Note: schema uses z.int() without min constraint
    testNumberConstraints(modelColumnSchema, 'orderIndex', validColumnInput, {
      isInteger: true,
    });
  });

  describe('isNullable field', () => {
    testRequiredFields(modelColumnSchema, ['isNullable'], validColumnInput);
    testBooleanValidation(modelColumnSchema, 'isNullable', validColumnInput);
  });

  describe('isPrimaryKey field', () => {
    testRequiredFields(modelColumnSchema, ['isPrimaryKey'], validColumnInputPK);
    // Use validColumnInputPK (isNullable: false) to avoid triggering refinement conflict
    testBooleanValidation(modelColumnSchema, 'isPrimaryKey', validColumnInputPK);
  });

  describe('primary key constraint', () => {
    it('rejects primary key that is nullable', () => {
      const input = { ...validColumnInput, isPrimaryKey: true, isNullable: true };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('主键字段不能为空');
        expect(result.error.issues[0].path).toContain('isNullable');
      }
    });

    it('accepts primary key that is not nullable', () => {
      const input = { ...validColumnInput, isPrimaryKey: true, isNullable: false };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts non-primary key that is nullable', () => {
      const input = { ...validColumnInput, isPrimaryKey: false, isNullable: true };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('feature field', () => {
    it('accepts valid feature object', () => {
      const input = { ...validColumnInput, feature: { enabled: true } };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null feature', () => {
      const input = { ...validColumnInput, feature: null };
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing feature (optional)', () => {
      const { feature, ...input } = validColumnInput;
      const result = modelColumnSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: modelColumnSchema,
      validCases: [
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
            name: 'minimal_column',
            dataType: DataType.NUMBER,
            orderIndex: 0,
            isNullable: true,
            isPrimaryKey: false,
            feature: null,
          },
          description: 'minimal required fields',
        },
        {
          input: validColumnInput,
          description: 'all fields populated',
        },
        {
          input: {
            ...validColumnInput,
            isPrimaryKey: true,
            isNullable: false,
          },
          description: 'primary key column',
        },
      ],
      invalidCases: [
        {
          input: { dataType: DataType.STRING, orderIndex: 0, isNullable: true, isPrimaryKey: false },
          description: 'missing name',
        },
        {
          input: { name: 'column', orderIndex: 0, isNullable: true, isPrimaryKey: false },
          description: 'missing dataType',
        },
        {
          input: { name: 'column', dataType: DataType.STRING, isNullable: true, isPrimaryKey: false },
          description: 'missing orderIndex',
        },
        {
          input: { name: 'column', dataType: DataType.STRING, orderIndex: 0, isPrimaryKey: false },
          description: 'missing isNullable',
        },
        {
          input: { name: 'column', dataType: DataType.STRING, orderIndex: 0, isNullable: true },
          description: 'missing isPrimaryKey',
        },
        {
          input: {
            name: 'column',
            dataType: 'INVALID_TYPE',
            orderIndex: 0,
            isNullable: true,
            isPrimaryKey: false,
          },
          description: 'invalid dataType enum value',
        },
        {
          input: {
            ...validColumnInput,
            isPrimaryKey: true,
            isNullable: true,
          },
          description: 'primary key with nullable',
        },
      ],
    });
  });
});

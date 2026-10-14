import { describe, it, expect } from 'vitest';
import { tagRuleSchema } from '@/modules/tag/contracts/schemas/request/tag/tagRuleSchema';
import { RuleType } from '@/shared/enums/tag/RuleType';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testStringConstraints,
  testEnumValidation,
} from '../../../../helpers/schema-test-utils';

describe('tagRuleSchema', () => {
  const validInput = {
    ruleType: RuleType.SQL,
    ruleContent: 'SELECT * FROM users WHERE active = true',
    dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(tagRuleSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(tagRuleSchema, ['ruleType', 'dataModelIds'], validInput);
  });

  describe('optional fields', () => {
    testOptionalFields(tagRuleSchema, ['feature'], validInput);
    
    it('allows omitting ruleContent for non-SQL types', () => {
      const input = {
        ruleType: RuleType.SPARK,
        dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
    
    it('allows omitting steps for non-CASCADE types', () => {
      const input = {
        ruleType: RuleType.SQL,
        ruleContent: 'SELECT 1',
        dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
  
  describe('ruleType field', () => {
    testEnumValidation(tagRuleSchema, 'ruleType', [RuleType.SQL, RuleType.SPARK, RuleType.PYTHON], validInput);
    
    it('accepts ruleType = "CASCADE" with steps', () => {
      const input = {
        ruleType: RuleType.CASCADE,
        steps: [{ order: 1, sql: 'SELECT 1' }],
        dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('ruleContent field', () => {
    testStringConstraints(tagRuleSchema, 'ruleContent', validInput, {
      minLength: 1,
      maxLength: 10000,
      allowEmpty: false,
    });

    it('trims whitespace from ruleContent', () => {
      const input = { ...validInput, ruleContent: '  SELECT * FROM users  ' };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ruleContent).toBe('SELECT * FROM users');
      }
    });
  });

  describe('dataModelIds field', () => {
    it('accepts array with one valid UUID', () => {
      const input = { ...validInput, dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts array with multiple valid UUIDs', () => {
      const input = {
        ...validInput,
        dataModelIds: [
          '123e4567-e89b-12d3-a456-426614174000',
          '123e4567-e89b-12d3-a456-426614174001',
        ],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects empty array', () => {
      const input = { ...validInput, dataModelIds: [] };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUID in array', () => {
      const input = { ...validInput, dataModelIds: ['invalid-uuid'] };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects non-array dataModelIds', () => {
      const input = { ...validInput, dataModelIds: 'not-an-array' };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('feature field', () => {
    it('accepts object feature', () => {
      const input = { ...validInput, feature: { enabled: true } };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null feature', () => {
      const input = { ...validInput, feature: null };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts string feature', () => {
      const input = { ...validInput, feature: 'feature-string' };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: tagRuleSchema,
      validCases: [
        {
          input: validInput,
          description: 'all fields populated',
        },
        {
          input: {
            ruleType: RuleType.SPARK,
            ruleContent: 'Spark rule',
            dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
          },
          description: 'different ruleType without feature',
        },
        {
          input: {
            ruleType: RuleType.CASCADE,
            steps: [
              { order: 1, sql: 'SELECT entity_id FROM users' },
              { order: 2, sql: 'SELECT entity_id FROM step1 WHERE active = true' },
            ],
            dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
          },
          description: 'CASCADE type with steps',
        },
      ],
      invalidCases: [
        {
          input: { ruleContent: 'SELECT *', dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] },
          description: 'missing ruleType',
        },
        {
          input: { ruleType: RuleType.SQL, ruleContent: '', dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] },
          description: 'empty ruleContent',
        },
        {
          input: { ruleType: RuleType.SQL, ruleContent: 'SELECT *' },
          description: 'missing dataModelIds',
        },
        {
          input: { ruleType: 'INVALID', ruleContent: 'SELECT *', dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] },
          description: 'invalid ruleType enum',
        },
        {
          input: { ...validInput, dataModelIds: [] },
          description: 'empty dataModelIds array',
        },
        {
          input: { ruleType: RuleType.CASCADE, dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] },
          description: 'CASCADE without steps',
        },
        {
          input: { ruleType: RuleType.CASCADE, steps: [], dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] },
          description: 'CASCADE with empty steps',
        },
        {
          input: { ruleType: RuleType.CASCADE, steps: [{ order: 1, sql: '' }], dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] },
          description: 'CASCADE with empty sql in step',
        },
        {
          input: { ruleType: RuleType.SQL, dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] },
          description: 'SQL without ruleContent',
        },
      ],
    });
  });

  describe('CASCADE steps validation', () => {
    it('accepts valid cascade steps', () => {
      const input = {
        ruleType: RuleType.CASCADE,
        steps: [
          { order: 1, sql: 'SELECT entity_id FROM users LIMIT 100' },
          { order: 2, sql: 'SELECT entity_id FROM step1 WHERE score > 10' },
        ],
        dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects cascade step with missing sql', () => {
      const input = {
        ruleType: RuleType.CASCADE,
        steps: [{ order: 1 }],
        dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects cascade step with missing order', () => {
      const input = {
        ruleType: RuleType.CASCADE,
        steps: [{ sql: 'SELECT 1' }],
        dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects cascade step with negative order', () => {
      const input = {
        ruleType: RuleType.CASCADE,
        steps: [{ order: -1, sql: 'SELECT 1' }],
        dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = tagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});



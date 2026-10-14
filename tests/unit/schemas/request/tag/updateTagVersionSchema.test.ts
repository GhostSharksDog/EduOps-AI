import { describe, it, expect } from 'vitest';
import { updateTagVersionSchema } from '@/modules/tag/contracts/schemas/request/tag/updateTagVersionSchema';
import { RuleType } from '@/shared/enums/tag/RuleType';
import {
  testSchema,
  testStrictObject,
  testOptionalFields,
  testStringConstraints,
} from '../../../../helpers/schema-test-utils';

describe('updateTagVersionSchema', () => {
  const validInput = {
    description: 'Updated description',
    rule: {
      ruleType: RuleType.SQL,
      ruleContent: 'SELECT * FROM users WHERE active = true',
      dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
      feature: { enabled: true },
    },
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(updateTagVersionSchema, validInput);
  });

  describe('all fields optional', () => {
    testOptionalFields(updateTagVersionSchema, ['description', 'rule', 'feature'], validInput);
  });

  describe('description field', () => {
    testStringConstraints(updateTagVersionSchema, 'description', { ...validInput, description: 'Test' }, {
      allowEmpty: true,
    });

    it('trims whitespace from description', () => {
      const input = { description: '  Test description  ' };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Test description');
      }
    });
  });

  describe('rule field', () => {
    it('accepts valid rule object', () => {
      const input = {
        rule: {
          ruleType: RuleType.SQL,
          ruleContent: 'SELECT * FROM users',
          dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
          feature: {},
        },
      };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts rule with SPARK type', () => {
      const input = {
        rule: {
          ruleType: RuleType.SPARK,
          ruleContent: 'Spark rule content',
          dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'],
          feature: null,
        },
      };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects rule with invalid ruleType', () => {
      const input = {
        rule: {
          ruleType: 'INVALID',
          ruleContent: 'Test',
          dataModelIds: [],
          feature: {},
        },
      };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects rule with empty dataModelIds', () => {
      const input = {
        rule: {
          ruleType: RuleType.SQL,
          ruleContent: 'SELECT *',
          dataModelIds: [],
          feature: {},
        },
      };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects rule with invalid UUID in dataModelIds', () => {
      const input = {
        rule: {
          ruleType: RuleType.SQL,
          ruleContent: 'SELECT *',
          dataModelIds: ['invalid-uuid'],
          feature: {},
        },
      };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('feature field', () => {
    it('accepts object feature', () => {
      const input = { feature: { enabled: true } };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null feature', () => {
      const input = { feature: null };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts string feature', () => {
      const input = { feature: 'feature-string' };
      const result = updateTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: updateTagVersionSchema,
      validCases: [
        {
          input: {},
          description: 'empty object - all fields optional',
        },
        {
          input: { description: 'Only description' },
          description: 'only description',
        },
        {
          input: { feature: { key: 'value' } },
          description: 'only feature',
        },
        {
          input: validInput,
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { extra: 'field' },
          description: 'extra field rejected',
        },
        {
          input: { rule: { ruleType: 'INVALID' } },
          description: 'invalid rule nested object',
        },
      ],
    });
  });
});

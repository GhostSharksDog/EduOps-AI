import { describe, it, expect } from 'vitest';
import { createTagVersionSchema } from '@/modules/tag/contracts/schemas/request/tag/createTagVersionSchema';
import { RuleType } from '@/shared/enums/tag/RuleType';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testUUIDValidation,
  testStringConstraints,
  testEnumValidation,
} from '../../../../helpers/schema-test-utils';

describe('createTagVersionSchema', () => {
  const validInput = {
    tagId: '123e4567-e89b-12d3-a456-426614174000',
    version: '1.0.0',
    description: 'Initial version',
    rule: {
      ruleType: RuleType.SQL,
      ruleContent: 'SELECT * FROM users',
      dataModelIds: ['123e4567-e89b-12d3-a456-426614174001'],
      feature: { enabled: true },
    },
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(createTagVersionSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(createTagVersionSchema, ['tagId', 'version'], validInput);
  });

  describe('optional fields', () => {
    testOptionalFields(createTagVersionSchema, ['description', 'rule', 'feature'], validInput);
  });

  describe('tagId field', () => {
    testUUIDValidation(createTagVersionSchema, 'tagId', validInput);
  });

  describe('version field', () => {
    it('accepts any string version', () => {
      const input = { tagId: validInput.tagId, version: 'any-version-string' };
      const result = createTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts empty string version (no min constraint)', () => {
      const input = { tagId: validInput.tagId, version: '' };
      const result = createTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from version', () => {
      const input = { tagId: validInput.tagId, version: '  1.0.0  ' };
      const result = createTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0');
      }
    });
  });

  // description field is optional string - no constraints to test


  describe('rule field', () => {
    describe('ruleType', () => {
      it('accepts SQL ruleType', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, ruleType: RuleType.SQL } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts SPARK ruleType', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, ruleType: RuleType.SPARK } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts PYTHON ruleType', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, ruleType: RuleType.PYTHON } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('rejects invalid ruleType', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, ruleType: 'INVALID' } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('ruleContent', () => {
      it('accepts valid ruleContent', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, ruleContent: 'SELECT * FROM users' } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts empty ruleContent (no min constraint)', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, ruleContent: '' } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('trims whitespace from ruleContent', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, ruleContent: '  SELECT 1  ' } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success && result.data.rule) {
          expect(result.data.rule.ruleContent).toBe('SELECT 1');
        }
      });
    });

    describe('dataModelIds', () => {
      it('accepts array with one valid UUID', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, dataModelIds: ['123e4567-e89b-12d3-a456-426614174000'] } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('rejects empty array', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, dataModelIds: [] } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('rejects invalid UUID in array', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, dataModelIds: ['invalid-uuid'] } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('feature in rule', () => {
      it('accepts valid feature object', () => {
        const input = { ...validInput, rule: { ...validInput.rule!, feature: { key: 'value' } } };
        const result = createTagVersionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('feature field', () => {
    it('accepts valid feature object', () => {
      const input = { ...validInput, feature: { enabled: true } };
      const result = createTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null feature', () => {
      const input = { ...validInput, feature: null };
      const result = createTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing feature (optional)', () => {
      const input = { tagId: validInput.tagId, version: '1.0.0' };
      const result = createTagVersionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: createTagVersionSchema,
      validCases: [
        {
          input: {
            tagId: '123e4567-e89b-12d3-a456-426614174000',
            version: '1.0.0',
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
          input: { version: '1.0.0' },
          description: 'missing tagId',
        },
        {
          input: { tagId: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'missing version',
        },
        {
          input: {
            tagId: 'invalid-uuid',
            version: '1.0.0',
          },
          description: 'invalid tagId UUID',
        },
      ],
    });
  });
});

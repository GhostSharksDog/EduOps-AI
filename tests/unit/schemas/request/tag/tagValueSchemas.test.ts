import { describe, it, expect } from 'vitest';
import {
  getTagValuesSchema,
  getTagValueSchema,
  activateTagSchema,
  updateTagRuleSchema,
  updateTagCycleSchema,
} from '@/modules/tag/contracts/schemas/request/tag/tagValueSchemas';
import { RuleType } from '@/shared/enums/tag/RuleType';
import { UpdateCycle } from '@/shared/enums/tag/UpdateCycle';

describe('tagValueSchemas', () => {
  const validTagId = '123e4567-e89b-12d3-a456-426614174000';
  const validEntityId = '123e4567-e89b-12d3-a456-426614174001';
  const validVersionId = '123e4567-e89b-12d3-a456-426614174002';

  describe('getTagValuesSchema', () => {
    it('accepts valid input with required fields', () => {
      const input = { tagId: validTagId, entityIds: 'id1,id2,id3' };
      const result = getTagValuesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts input with optional versionId', () => {
      const input = { tagId: validTagId, entityIds: 'id1,id2', versionId: validVersionId };
      const result = getTagValuesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing tagId', () => {
      const input = { entityIds: 'id1,id2' };
      const result = getTagValuesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing entityIds', () => {
      const input = { tagId: validTagId };
      const result = getTagValuesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid tagId UUID', () => {
      const input = { tagId: 'invalid-uuid', entityIds: 'id1,id2' };
      const result = getTagValuesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('getTagValueSchema', () => {
    it('accepts valid input with required fields', () => {
      const input = { tagId: validTagId, entityId: validEntityId };
      const result = getTagValueSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts input with optional versionId', () => {
      const input = { tagId: validTagId, entityId: validEntityId, versionId: validVersionId };
      const result = getTagValueSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing tagId', () => {
      const input = { entityId: validEntityId };
      const result = getTagValueSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing entityId', () => {
      const input = { tagId: validTagId };
      const result = getTagValueSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUIDs', () => {
      const input = { tagId: 'invalid', entityId: 'invalid' };
      const result = getTagValueSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('activateTagSchema', () => {
    it('accepts valid tagId', () => {
      const input = { tagId: validTagId };
      const result = activateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing tagId', () => {
      const input = {};
      const result = activateTagSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUID', () => {
      const input = { tagId: 'invalid-uuid' };
      const result = activateTagSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateTagRuleSchema', () => {
    it('accepts valid input with rule', () => {
      const input = {
        tagId: validTagId,
        rule: {
          ruleType: RuleType.SQL,
          ruleContent: 'SELECT * FROM users',
          steps: [{ order: 1, sql: 'SELECT * FROM users' }],
          dataModelIds: [validEntityId],
        },
      };
      const result = updateTagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts rule with CASCADE type', () => {
      const input = {
        tagId: validTagId,
        rule: {
          ruleType: 'CASCADE',
        },
      };
      const result = updateTagRuleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing tagId', () => {
      const input = {
        rule: {
          ruleType: RuleType.SQL,
          dataModelIds: [],
        },
      };
      const result = updateTagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing rule', () => {
      const input = { tagId: validTagId };
      const result = updateTagRuleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateTagCycleSchema', () => {
    it('accepts valid input with REALTIME', () => {
      const input = { tagId: validTagId, cycle: UpdateCycle.REALTIME };
      const result = updateTagCycleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts valid input with DAILY', () => {
      const input = { tagId: validTagId, cycle: UpdateCycle.DAILY };
      const result = updateTagCycleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts valid input with WEEKLY', () => {
      const input = { tagId: validTagId, cycle: UpdateCycle.WEEKLY };
      const result = updateTagCycleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing tagId', () => {
      const input = { cycle: UpdateCycle.DAILY };
      const result = updateTagCycleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing cycle', () => {
      const input = { tagId: validTagId };
      const result = updateTagCycleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid cycle enum', () => {
      const input = { tagId: validTagId, cycle: 'INVALID' };
      const result = updateTagCycleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

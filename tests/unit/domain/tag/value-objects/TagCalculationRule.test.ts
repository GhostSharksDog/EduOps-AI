import { describe, it, expect } from 'vitest';
import {
  TagCalculationRule,
  SingleStepRule,
  CascadeRule,
  CascadeStep,
  isCascadeRule,
  isSingleStepRule,
  createSingleStepRule,
  createCascadeRule,
  validateRule
} from '@/modules/tag/domain/value-objects/TagCalculationRule';

describe('TagCalculationRule Value Object', () => {
  describe('isSingleStepRule', () => {
    it('should return true for SQL rule type', () => {
      const rule: SingleStepRule = {
        ruleType: 'SQL',
        ruleContent: 'SELECT * FROM users WHERE age > 18',
        dataModelIds: ['model-1']
      };

      expect(isSingleStepRule(rule)).toBe(true);
    });

    it('should return false for CASCADE rule type', () => {
      const rule: CascadeRule = {
        ruleType: 'CASCADE',
        steps: [{ order: 1, sql: 'SELECT * FROM users' }],
        dataModelIds: []
      };

      expect(isSingleStepRule(rule)).toBe(false);
    });
  });

  describe('isCascadeRule', () => {
    it('should return true for CASCADE rule type', () => {
      const rule: CascadeRule = {
        ruleType: 'CASCADE',
        steps: [
          { order: 1, sql: 'SELECT * FROM users' },
          { order: 2, sql: 'SELECT * FROM orders' }
        ],
        dataModelIds: ['model-1', 'model-2']
      };

      expect(isCascadeRule(rule)).toBe(true);
    });

    it('should return false for SQL rule type', () => {
      const rule: SingleStepRule = {
        ruleType: 'SQL',
        ruleContent: 'SELECT * FROM users',
        dataModelIds: []
      };

      expect(isCascadeRule(rule)).toBe(false);
    });
  });

  describe('createSingleStepRule', () => {
    it('should create a valid single step SQL rule', () => {
      const rule = createSingleStepRule(
        'SELECT * FROM users WHERE age > 18',
        ['model-1']
      );

      expect(rule.ruleType).toBe('SQL');
      expect(rule.ruleContent).toBe('SELECT * FROM users WHERE age > 18');
      expect(rule.dataModelIds).toEqual(['model-1']);
    });

    it('should create rule with empty data model ids by default', () => {
      const rule = createSingleStepRule('SELECT 1');

      expect(rule.dataModelIds).toEqual([]);
    });
  });

  describe('createCascadeRule', () => {
    it('should create a valid cascade rule with sorted steps', () => {
      const steps: CascadeStep[] = [
        { order: 2, sql: 'SELECT * FROM orders' },
        { order: 1, sql: 'SELECT * FROM users' }
      ];

      const rule = createCascadeRule(steps, ['model-1']);

      expect(rule.ruleType).toBe('CASCADE');
      expect(rule.steps).toHaveLength(2);
      // Steps should be sorted by order
      expect(rule.steps[0].order).toBe(1);
      expect(rule.steps[1].order).toBe(2);
      expect(rule.dataModelIds).toEqual(['model-1']);
    });

    it('should create rule with empty data model ids by default', () => {
      const steps: CascadeStep[] = [
        { order: 1, sql: 'SELECT 1' }
      ];

      const rule = createCascadeRule(steps);

      expect(rule.dataModelIds).toEqual([]);
    });

    it('should preserve step order regardless of input order', () => {
      const steps: CascadeStep[] = [
        { order: 3, sql: 'Step 3' },
        { order: 1, sql: 'Step 1' },
        { order: 2, sql: 'Step 2' }
      ];

      const rule = createCascadeRule(steps);

      expect(rule.steps[0].order).toBe(1);
      expect(rule.steps[1].order).toBe(2);
      expect(rule.steps[2].order).toBe(3);
    });
  });

  describe('validateRule', () => {
    describe('SingleStepRule validation', () => {
      it('should return valid for correct SQL rule', () => {
        const rule: SingleStepRule = {
          ruleType: 'SQL',
          ruleContent: 'SELECT * FROM users',
          dataModelIds: []
        };

        const result = validateRule(rule);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return error when ruleContent is empty', () => {
        const rule: SingleStepRule = {
          ruleType: 'SQL',
          ruleContent: '',
          dataModelIds: []
        };

        const result = validateRule(rule);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('ruleContent is required for SQL rule');
      });

      it('should return error when ruleContent is whitespace only', () => {
        const rule: SingleStepRule = {
          ruleType: 'SQL',
          ruleContent: '   ',
          dataModelIds: []
        };

        const result = validateRule(rule);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('ruleContent is required for SQL rule');
      });
    });

    describe('CascadeRule validation', () => {
      it('should return valid for correct CASCADE rule', () => {
        const rule: CascadeRule = {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: 'SELECT * FROM users' },
            { order: 2, sql: 'SELECT * FROM orders' }
          ],
          dataModelIds: []
        };

        const result = validateRule(rule);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return error when steps is empty', () => {
        const rule: CascadeRule = {
          ruleType: 'CASCADE',
          steps: [],
          dataModelIds: []
        };

        const result = validateRule(rule);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('steps is required for CASCADE rule');
      });

      it('should return error when step sql is empty', () => {
        const rule: CascadeRule = {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: '' }
          ],
          dataModelIds: []
        };

        const result = validateRule(rule);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('steps[0].sql is required');
      });

      it('should return multiple errors for multiple invalid steps', () => {
        const rule: CascadeRule = {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: '' },
            { order: 2, sql: '   ' }
          ],
          dataModelIds: []
        };

        const result = validateRule(rule);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('steps[0].sql is required');
        expect(result.errors).toContain('steps[1].sql is required');
      });
    });

    describe('General validation', () => {
      it('should return error when ruleType is missing', () => {
        const rule = {
          ruleContent: 'SELECT 1',
          dataModelIds: []
        } as unknown as TagCalculationRule;

        const result = validateRule(rule);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('ruleType is required');
      });
    });
  });
});

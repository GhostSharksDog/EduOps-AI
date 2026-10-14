import { describe, it, expect } from 'vitest';
import { SegmentConditionGroup } from '@/modules/segment/domain/value-objects/SegmentConditionGroup';
import { SegmentCondition } from '@/modules/segment/domain/value-objects/SegmentCondition';
import { ComparisonOperator, ConditionOperator } from '@/shared/enums/index';

describe('SegmentConditionGroup', () => {
  describe('interface structure', () => {
    it('should define a valid condition group with AND operator', () => {
      const group: SegmentConditionGroup = {
        operator: ConditionOperator.AND,
        conditions: []
      };

      expect(group.operator).toBe(ConditionOperator.AND);
      expect(group.conditions).toHaveLength(0);
    });

    it('should define a valid condition group with OR operator', () => {
      const group: SegmentConditionGroup = {
        operator: ConditionOperator.OR,
        conditions: []
      };

      expect(group.operator).toBe(ConditionOperator.OR);
      expect(group.conditions).toHaveLength(0);
    });

    it('should support nested conditions', () => {
      const condition: SegmentCondition = {
        id: 'cond-1',
        tagId: 'tag-123',
        operator: ComparisonOperator.EQUAL,
        value: 'active',
        valueType: 'STRING'
      };

      const group: SegmentConditionGroup = {
        operator: ConditionOperator.AND,
        conditions: [condition]
      };

      expect(group.conditions).toHaveLength(1);
      expect((group.conditions[0] as SegmentCondition).tagId).toBe('tag-123');
    });

    it('should support nested condition groups', () => {
      const innerCondition: SegmentCondition = {
        id: 'cond-1',
        tagId: 'tag-1',
        operator: ComparisonOperator.GREATER_THAN,
        value: '18',
        valueType: 'NUMBER'
      };

      const innerGroup: SegmentConditionGroup = {
        operator: ConditionOperator.OR,
        conditions: [innerCondition]
      };

      const outerGroup: SegmentConditionGroup = {
        operator: ConditionOperator.AND,
        conditions: [innerGroup]
      };

      expect(outerGroup.conditions).toHaveLength(1);
      expect((outerGroup.conditions[0] as SegmentConditionGroup).operator).toBe(ConditionOperator.OR);
    });

    it('should support complex nested structure', () => {
      const condition1: SegmentCondition = {
        id: 'cond-1',
        tagId: 'tag-1',
        operator: ComparisonOperator.EQUAL,
        value: 'active',
        valueType: 'STRING'
      };

      const condition2: SegmentCondition = {
        id: 'cond-2',
        tagId: 'tag-2',
        operator: ComparisonOperator.GREATER_THAN,
        value: '100',
        valueType: 'NUMBER'
      };

      const innerGroup: SegmentConditionGroup = {
        operator: ConditionOperator.OR,
        conditions: [condition1, condition2]
      };

      const condition3: SegmentCondition = {
        id: 'cond-3',
        tagId: 'tag-3',
        operator: ComparisonOperator.NOT_EQUAL,
        value: 'blocked',
        valueType: 'STRING'
      };

      const outerGroup: SegmentConditionGroup = {
        operator: ConditionOperator.AND,
        conditions: [innerGroup, condition3]
      };

      expect(outerGroup.conditions).toHaveLength(2);
      expect((outerGroup.conditions[0] as SegmentConditionGroup).conditions).toHaveLength(2);
    });
  });

  describe('condition types', () => {
    it('should support all comparison operators', () => {
      const operators = [
        ComparisonOperator.EQUAL,
        ComparisonOperator.NOT_EQUAL,
        ComparisonOperator.GREATER_THAN,
        ComparisonOperator.LESS_THAN,
        ComparisonOperator.GREATER_THAN_EQUAL,
        ComparisonOperator.LESS_THAN_EQUAL,
        ComparisonOperator.IN,
        ComparisonOperator.NOT_IN,
        ComparisonOperator.CONTAINS,
        ComparisonOperator.NOT_CONTAINS,
        ComparisonOperator.IS_NULL,
        ComparisonOperator.IS_NOT_NULL
      ];

      operators.forEach(operator => {
        const condition: SegmentCondition = {
          id: `cond-${operator}`,
          tagId: 'tag-1',
          operator,
          value: 'test',
          valueType: 'STRING'
        };

        expect(condition.operator).toBe(operator);
      });
    });

    it('should support different value types', () => {
      const stringCondition: SegmentCondition = {
        id: 'cond-1',
        tagId: 'tag-1',
        operator: ComparisonOperator.EQUAL,
        value: 'text',
        valueType: 'STRING'
      };

      const numberCondition: SegmentCondition = {
        id: 'cond-2',
        tagId: 'tag-2',
        operator: ComparisonOperator.GREATER_THAN,
        value: 100,
        valueType: 'NUMBER'
      };

      const booleanCondition: SegmentCondition = {
        id: 'cond-3',
        tagId: 'tag-3',
        operator: ComparisonOperator.EQUAL,
        value: true,
        valueType: 'BOOLEAN'
      };

      const arrayCondition: SegmentCondition = {
        id: 'cond-4',
        tagId: 'tag-4',
        operator: ComparisonOperator.IN,
        value: ['a', 'b', 'c'],
        valueType: 'ARRAY'
      };

      expect(stringCondition.valueType).toBe('STRING');
      expect(numberCondition.valueType).toBe('NUMBER');
      expect(booleanCondition.valueType).toBe('BOOLEAN');
      expect(arrayCondition.valueType).toBe('ARRAY');
    });
  });
});

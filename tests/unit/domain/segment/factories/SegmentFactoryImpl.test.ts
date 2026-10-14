import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentFactoryImpl } from '@/modules/segment/domain/factories/SegmentFactoryImpl';
import { SegmentCreateCommand, CreateSegmentConditionCommand, CreateSegmentConditionGroupCommand } from '@/modules/segment/contracts/commands/index';
import { SegmentType, ComparisonOperator, ConditionOperator, JoinMethod } from '@/shared/enums/index';

describe('SegmentFactoryImpl', () => {
  let factory: SegmentFactoryImpl;

  beforeEach(() => {
    factory = new SegmentFactoryImpl();
  });

  describe('createSegment', () => {
    it('should create a valid segment with required fields', () => {
      const command: SegmentCreateCommand = {
        name: 'Test Segment',
        type: SegmentType.STATIC,
        calculationType: 'BATCH',
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: []
        },
        createdBy: 'user-123'
      };

      const segment = factory.createSegment(command);

      expect(segment.id).toBeDefined();
      expect(segment.name).toBe('Test Segment');
      expect(segment.type).toBe(SegmentType.STATIC);
      expect(segment.createdBy).toBe('user-123');
      expect(segment.createTime).toBeInstanceOf(Date);
      expect(segment.isDeleted).toBe(false);
    });

    it('should create segment with description when provided', () => {
      const command: SegmentCreateCommand = {
        name: 'Test Segment',
        type: SegmentType.DYNAMIC,
        calculationType: 'REALTIME',
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: []
        },
        description: 'Test description',
        createdBy: 'user-123'
      };

      const segment = factory.createSegment(command);

      expect(segment.description).toBe('Test description');
    });

    it('should create segment with feature when provided', () => {
      const command: SegmentCreateCommand = {
        name: 'Test Segment',
        type: SegmentType.STATIC,
        calculationType: 'BATCH',
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: []
        },
        feature: {
          id: 'feature-1',
          name: 'Test Feature'
        },
        createdBy: 'user-123'
      };

      const segment = factory.createSegment(command);

      expect(segment.feature).toBeDefined();
      expect((segment.feature as { id: string }).id).toBe('feature-1');
    });

    it('should initialize member count to 0', () => {
      const command: SegmentCreateCommand = {
        name: 'Test Segment',
        type: SegmentType.STATIC,
        calculationType: 'BATCH',
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: []
        },
        createdBy: 'user-123'
      };

      const segment = factory.createSegment(command);

      expect(segment.memberCount).toBe(0);
    });

    it('should set initial status to DRAFT', () => {
      const command: SegmentCreateCommand = {
        name: 'Test Segment',
        type: SegmentType.STATIC,
        calculationType: 'BATCH',
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: []
        },
        createdBy: 'user-123'
      };

      const segment = factory.createSegment(command);

      expect(segment.status).toBe('DRAFT');
    });
  });

  describe('createCondition', () => {
    it('should create a valid segment condition', () => {
      const command: CreateSegmentConditionCommand = {
        tagId: 'tag-123',
        operator: ComparisonOperator.GREATER_THAN,
        value: '18',
        valueType: 'NUMBER',
        createdBy: 'user-123'
      };

      const condition = factory.createCondition(command);

      expect(condition.id).toBeDefined();
      expect(condition.tagId).toBe('tag-123');
      expect(condition.operator).toBe(ComparisonOperator.GREATER_THAN);
      expect(condition.value).toBe('18');
      expect(condition.valueType).toBe('NUMBER');
    });
  });

  describe('createConditionGroup', () => {
    it('should create a valid condition group', () => {
      const command: CreateSegmentConditionGroupCommand = {
        operator: ConditionOperator.AND,
        conditions: [],
        createdBy: 'user-123'
      };

      const group = factory.createConditionGroup(command);

      expect(group.operator).toBe(ConditionOperator.AND);
      expect(group.conditions).toHaveLength(0);
    });

    it('should create condition group with nested conditions', () => {
      const condition = factory.createCondition({
        tagId: 'tag-1',
        operator: ComparisonOperator.EQUAL,
        value: 'active',
        valueType: 'STRING',
        createdBy: 'user-123'
      });

      const command: CreateSegmentConditionGroupCommand = {
        operator: ConditionOperator.OR,
        conditions: [condition],
        createdBy: 'user-123'
      };

      const group = factory.createConditionGroup(command);

      expect(group.operator).toBe(ConditionOperator.OR);
      expect(group.conditions).toHaveLength(1);
    });
  });

  describe('createSegmentMember', () => {
    it('should create a valid segment member', () => {
      const command = {
        segmentId: 'segment-123',
        memberId: 'member-456',
        joinMethod: JoinMethod.MANUAL,
        createdBy: 'user-123'
      };

      const member = factory.createSegmentMember(command);

      expect(member.id).toBeDefined();
      expect(member.segmentId).toBe('segment-123');
      expect(member.memberId).toBe('member-456');
      expect(member.isDeleted).toBe(false);
    });
  });
});

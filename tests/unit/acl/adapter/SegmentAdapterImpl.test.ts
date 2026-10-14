import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentAdapterImpl } from '@/modules/segment/repositories/SegmentAdapterImpl';
import { Segment } from '@/modules/segment/domain/entities/Segment';
import { SegmentMember } from '@/modules/segment/domain/entities/SegmentMember';
import { SegmentCalculationTask } from '@/modules/segment/domain/entities/SegmentCalculationTask';
import { SegmentStatus, SegmentType, SegmentCalculationType, SegmentCalculationStatus, JoinMethod, ConditionOperator } from '@/shared/enums/index';

describe('SegmentAdapterImpl', () => {
  let adapter: SegmentAdapterImpl;

  beforeEach(() => {
    adapter = new SegmentAdapterImpl();
  });

  describe('fromPOToSegment', () => {
    it('should convert PO to domain entity correctly', () => {
      const po = {
        id: 'segment-123',
        name: 'Test Segment',
        description: 'Test description',
        entityType: 'USER',
        computeType: 'OFFLINE',
        ownedBy: 'user-123',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date('2024-01-01'),
        updateTime: new Date('2024-01-02'),
        createdBy: 'user-123',
        updatedBy: 'user-456',
        deleteTime: null,
        deletedBy: null,
        scheduleConfig: null,
        lastCalculationTime: null,
        feature: null
      };

      const entity = adapter.fromPOToSegment(po as any, []);

      expect(entity.id).toBe('segment-123');
      expect(entity.name).toBe('Test Segment');
      expect(entity.description).toBe('Test description');
      expect(entity.ownedBy).toBe('user-123');
      expect(entity.createTime).toEqual(new Date('2024-01-01'));
      expect(entity.isDeleted).toBe(false);
    });

    it('should handle null values in PO', () => {
      const po = {
        id: 'segment-1',
        name: null,
        description: null,
        entityType: null,
        computeType: null,
        ownedBy: null,
        status: null,
        isDeleted: false,
        createTime: null,
        createdBy: null,
        feature: null
      };

      const entity = adapter.fromPOToSegment(po as any, []);

      expect(entity.id).toBe('segment-1');
      expect(entity.name).toBe('Unnamed Segment');
      expect(entity.description).toBeUndefined();
    });

    it('should build condition tree from conditions', () => {
      const po = {
        id: 'segment-1',
        name: 'Test',
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        isDeleted: false,
        feature: null
      };

      const conditions = [
        {
          id: 'group-1',
          segmentId: 'segment-1',
          parentId: null,
          conditionType: 'GROUP',
          operator: 'AND',
          fieldName: null,
          fieldValue: null
        },
        {
          id: 'cond-1',
          segmentId: 'segment-1',
          parentId: 'group-1',
          conditionType: 'CONDITION',
          operator: 'EQUALS',
          fieldName: 'age',
          fieldValue: '18'
        }
      ];

      const entity = adapter.fromPOToSegment(po as any, conditions as any);

      expect(entity.conditionGroup).toBeDefined();
      // Guard against potential undefined in nested object via optional chaining
      expect(entity.conditionGroup?.operator).toBe(ConditionOperator.AND);
    });
  });

  describe('fromSegmentToPO', () => {
    it('should convert domain entity to PO correctly', () => {
      const segment = new Segment(
        'segment-123',
        'Test Segment',
        'user-123',
        new Date('2024-01-01'),
        'user-123',
        'Test description',
        false,
        undefined,
        new Date('2024-01-02'),
        undefined,
        undefined,
        undefined,
        SegmentType.USER,
        SegmentStatus.ACTIVE,
        SegmentCalculationType.OFFLINE
      );

      const po = adapter.fromSegmentToPO(segment);

      expect(po.id).toBe('segment-123');
      expect(po.name).toBe('Test Segment');
      expect(po.description).toBe('Test description');
      expect(po.ownedBy).toBe('user-123');
      expect(po.status).toBe('ACTIVE');
      expect(po.isDeleted).toBe(false);
    });

    it('should handle undefined description', () => {
      const segment = new Segment(
        'segment-1',
        'Test',
        'user-123',
        new Date(),
        'user-123'
      );

      const po = adapter.fromSegmentToPO(segment);

      expect(po.description).toBeNull();
    });
  });

  describe('fromMemberPOToSegmentMember', () => {
    it('should convert member PO to domain entity correctly', () => {
      const po = {
        id: 'member-123',
        segmentId: 'segment-1',
        memberId: 'user-456',
        joinMethod: 'MANUAL',
        joinTime: new Date('2024-01-01'),
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01'),
        createdBy: 'user-123',
        description: 'Test member',
        isDeleted: false,
        feature: null,
        updateTime: null,
        deleteTime: null,
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromMemberPOToSegmentMember(po as any);

      expect(entity.id).toBe('member-123');
      expect(entity.segmentId).toBe('segment-1');
      expect(entity.memberId).toBe('user-456');
      expect(entity.joinMethod).toBe(JoinMethod.MANUAL);
      expect(entity.isDeleted).toBe(false);
    });

    it('should set isActive based on isDeleted', () => {
      const activePo = {
        id: 'member-1',
        segmentId: 'segment-1',
        memberId: 'user-1',
        isDeleted: false
      };

      const deletedPo = {
        id: 'member-2',
        segmentId: 'segment-1',
        memberId: 'user-2',
        isDeleted: true
      };

      const activeEntity = adapter.fromMemberPOToSegmentMember(activePo as any);
      const deletedEntity = adapter.fromMemberPOToSegmentMember(deletedPo as any);

      expect(activeEntity.isDeleted).toBe(false);
      expect(deletedEntity.isDeleted).toBe(true);
    });
  });

  describe('fromSegmentMemberToMemberPO', () => {
    it('should convert domain member to PO correctly', () => {
      const member = new SegmentMember(
        'member-123',
        'segment-1',
        'user-456',
        JoinMethod.MANUAL,
        new Date('2024-01-01'),
        'user-123',
        new Date('2024-01-01'),
        'user-123',
        'Test member',
        false
      );

      const po = adapter.fromSegmentMemberToMemberPO(member);

      expect(po.id).toBe('member-123');
      expect(po.segmentId).toBe('segment-1');
      expect(po.memberId).toBe('user-456');
      expect(po.joinMethod).toBe(JoinMethod.MANUAL);
      expect(po.name).toBeNull();
    });
  });

  describe('fromTaskPOToSegmentCalculationTask', () => {
    it('should convert task PO to domain entity correctly', () => {
      const po = {
        id: 'task-123',
        segmentId: 'segment-1',
        name: 'Calculation Task',
        description: 'Test task',
        ownedBy: 'user-123',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-02'),
        status: 'COMPLETED',
        resultCount: 1000,
        errorMessage: null,
        isDeleted: false,
        feature: null,
        createTime: new Date('2024-01-01'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromTaskPOToSegmentCalculationTask(po as any);

      expect(entity.id).toBe('task-123');
      expect(entity.segmentId).toBe('segment-1');
      expect(entity.name).toBe('Calculation Task');
      expect(entity.status).toBe(SegmentCalculationStatus.COMPLETED);
      expect(entity.resultCount).toBe(1000);
    });

    it('should handle null startTime', () => {
      const po = {
        id: 'task-1',
        segmentId: 'segment-1',
        name: 'Task',
        ownedBy: 'user-123',
        startTime: null,
        status: 'PENDING',
        createdBy: 'user-123'
      };

      const entity = adapter.fromTaskPOToSegmentCalculationTask(po as any);

      expect(entity.startTime).toBeInstanceOf(Date);
    });
  });

  describe('fromSegmentCalculationTaskToTaskPO', () => {
    it('should convert domain task to PO correctly', () => {
      const task = new SegmentCalculationTask(
        'segment-1',
        'Calculation Task',
        'user-123',
        'user-123',
        SegmentCalculationStatus.COMPLETED,
        'Test task',
        'task-123'
      );
      task.resultCount = 1000;
      task.startTime = new Date('2024-01-01');

      const po = adapter.fromSegmentCalculationTaskToTaskPO(task);

      expect(po.id).toBe('task-123');
      expect(po.segmentId).toBe('segment-1');
      expect(po.name).toBe('Calculation Task');
      expect(po.status).toBe(SegmentCalculationStatus.COMPLETED);
      expect(po.resultCount).toBe(1000);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SegmentCalculationTaskAdapterImpl } from '@/modules/segment/repositories/SegmentCalculationTaskAdapterImpl';
import { SegmentCalculationTask } from '@/modules/segment/domain/entities/SegmentCalculationTask';
import type { SegmentCalculationTaskPO } from '@/modules/segment/repositories/persistence/SegmentCalculationTaskPO';
import { SegmentCalculationStatus } from '@/shared/enums/index';

// Mock config to provide system.userId
vi.mock('@/platform/config/index', () => ({
  config: {
    system: {
      userId: 'system-user-123'
    }
  }
}));

describe('SegmentCalculationTaskAdapterImpl', () => {
  let adapter: SegmentCalculationTaskAdapterImpl;

  beforeEach(() => {
    adapter = new SegmentCalculationTaskAdapterImpl();
    vi.clearAllMocks();
  });

  describe('fromPOToSegmentCalculationTask', () => {
    it('should convert PO to SegmentCalculationTask entity with all fields', () => {
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.COMPLETED,
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        endTime: new Date('2024-01-01T10:30:00.000Z'),
        resultCount: 1500,
        errorMessage: null,
        name: 'Calculation Task',
        ownedBy: 'user-123',
        description: 'Task description',
        isDeleted: false,
        feature: { priority: 'high' },
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: new Date('2024-01-01T10:30:00.000Z'),
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: 'user-456',
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.id).toBe('task-123');
      expect(entity.segmentId).toBe('segment-456');
      expect(entity.status).toBe(SegmentCalculationStatus.COMPLETED);
      expect(entity.startTime).toEqual(new Date('2024-01-01T10:00:00.000Z'));
      expect(entity.endTime).toEqual(new Date('2024-01-01T10:30:00.000Z'));
      expect(entity.resultCount).toBe(1500);
    });

    it('should handle null name with default value', () => {
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.PENDING,
        startTime: null,
        endTime: null,
        resultCount: 0,
        errorMessage: null,
        name: null,
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.name).toBe('Unnamed Task');
    });

    it('should default status to PENDING when not provided', () => {
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: null as any,
        startTime: null,
        endTime: null,
        resultCount: 0,
        errorMessage: null,
        name: null,
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.status).toBe(SegmentCalculationStatus.PENDING);
    });

    it('should handle null description', () => {
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.PENDING,
        startTime: null,
        endTime: null,
        resultCount: 0,
        errorMessage: null,
        name: 'Task',
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.description).toBeUndefined();
    });

    it('should set startTime when provided', () => {
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.RUNNING,
        startTime: startTime,
        endTime: null,
        resultCount: 0,
        errorMessage: null,
        name: 'Task',
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.startTime).toEqual(startTime);
    });

    it('should set endTime when provided', () => {
      const endTime = new Date('2024-01-01T10:30:00.000Z');
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.COMPLETED,
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        endTime: endTime,
        resultCount: 100,
        errorMessage: null,
        name: 'Task',
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.endTime).toEqual(endTime);
    });

    it('should set resultCount when provided', () => {
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.COMPLETED,
        startTime: null,
        endTime: null,
        resultCount: 500,
        errorMessage: null,
        name: 'Task',
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.resultCount).toBe(500);
    });

    it('should set errorMessage when provided', () => {
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.FAILED,
        startTime: null,
        endTime: null,
        resultCount: 0,
        errorMessage: 'Connection timeout',
        name: 'Task',
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.errorMessage).toBe('Connection timeout');
    });

    it('should set isDeleted when true', () => {
      const po: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.PENDING,
        startTime: null,
        endTime: null,
        resultCount: 0,
        errorMessage: null,
        name: 'Task',
        ownedBy: 'user-123',
        description: null,
        isDeleted: true,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(po);

      expect(entity.isDeleted).toBe(true);
    });
  });

  describe('fromSegmentCalculationTaskToPO', () => {
    it('should convert SegmentCalculationTask entity to PO with all fields', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Calculation Task',
        'user-123',
        'user-123',
        SegmentCalculationStatus.COMPLETED,
        'Task description',
        'task-123'
      );
      entity.startTime = new Date('2024-01-01T10:00:00.000Z');
      entity.endTime = new Date('2024-01-01T10:30:00.000Z');
      entity.resultCount = 1500;

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.id).toBe('task-123');
      expect(po.segmentId).toBe('segment-456');
      expect(po.status).toBe(SegmentCalculationStatus.COMPLETED);
      expect(po.startTime).toEqual(new Date('2024-01-01T10:00:00.000Z'));
      expect(po.endTime).toEqual(new Date('2024-01-01T10:30:00.000Z'));
      expect(po.resultCount).toBe(1500);
    });

    it('should handle null endTime', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Calculation Task',
        'user-123',
        'user-123',
        SegmentCalculationStatus.RUNNING
      );
      entity.startTime = new Date('2024-01-01T10:00:00.000Z');

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.endTime).toBeNull();
    });

    it('should handle null errorMessage', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Calculation Task',
        'user-123',
        'user-123',
        SegmentCalculationStatus.COMPLETED
      );

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.errorMessage).toBeNull();
    });

    it('should default resultCount to 0 when not set', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Calculation Task',
        'user-123',
        'user-123',
        SegmentCalculationStatus.PENDING
      );

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.resultCount).toBe(0);
    });

    it('should use system userId as createdBy when not set', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Calculation Task',
        'user-123',
        undefined as any,
        SegmentCalculationStatus.PENDING
      );

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.createdBy).toBe('system-user-123');
    });

    it('should set name to null in PO', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Task Name',
        'user-123',
        'user-123',
        SegmentCalculationStatus.PENDING
      );

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.name).toBeNull();
    });

    it('should set description to null in PO', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Task Name',
        'user-123',
        'user-123',
        SegmentCalculationStatus.PENDING,
        'Description'
      );

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.description).toBeNull();
    });

    it('should set isDeleted to false in PO', () => {
      const entity = new SegmentCalculationTask(
        'segment-456',
        'Task Name',
        'user-123',
        'user-123',
        SegmentCalculationStatus.PENDING
      );

      const po = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(po.isDeleted).toBe(false);
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through PO -> Entity -> PO conversion', () => {
      const originalPO: SegmentCalculationTaskPO = {
        id: 'task-123',
        segmentId: 'segment-456',
        status: SegmentCalculationStatus.COMPLETED,
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        endTime: new Date('2024-01-01T10:30:00.000Z'),
        resultCount: 1000,
        errorMessage: null,
        name: 'Task',
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T09:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToSegmentCalculationTask(originalPO);
      const convertedPO = adapter.fromSegmentCalculationTaskToPO(entity);

      expect(convertedPO.id).toBe(originalPO.id);
      expect(convertedPO.segmentId).toBe(originalPO.segmentId);
      expect(convertedPO.status).toBe(originalPO.status);
      expect(convertedPO.resultCount).toBe(originalPO.resultCount);
    });
  });
});

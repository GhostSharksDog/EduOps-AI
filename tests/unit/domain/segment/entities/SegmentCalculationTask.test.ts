import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentCalculationTask } from '@/modules/segment/domain/entities/SegmentCalculationTask';
import { SegmentCalculationStatus } from '@/shared/enums/index';

describe('SegmentCalculationTask Entity', () => {
  let task: SegmentCalculationTask;

  beforeEach(() => {
    task = new SegmentCalculationTask(
      'segment-001',
      'Calculation Task',
      'user-001',
      'user-001',
      SegmentCalculationStatus.PENDING
    );
  });

  describe('constructor', () => {
    it('should create task with required fields', () => {
      expect(task.id).toBeDefined();
      expect(task.segmentId).toBe('segment-001');
      expect(task.name).toBe('Calculation Task');
      expect(task.ownedBy).toBe('user-001');
      expect(task.status).toBe(SegmentCalculationStatus.PENDING);
      expect(task.isDeleted).toBe(false);
      expect(task.resultCount).toBe(0);
    });

    it('should generate UUID if id not provided', () => {
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
    });
  });

  describe('start', () => {
    it('should set status to RUNNING', () => {
      task.start();
      expect(task.status).toBe(SegmentCalculationStatus.RUNNING);
      expect(task.updateTime).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should set status to COMPLETED and set endTime', () => {
      task.complete(100);
      expect(task.status).toBe(SegmentCalculationStatus.COMPLETED);
      expect(task.endTime).toBeDefined();
      expect(task.resultCount).toBe(100);
    });
  });

  describe('fail', () => {
    it('should set status to FAILED and set errorMessage', () => {
      task.fail('Task failed');
      expect(task.status).toBe(SegmentCalculationStatus.FAILED);
      expect(task.endTime).toBeDefined();
      expect(task.errorMessage).toBe('Task failed');
    });
  });

  describe('softDelete', () => {
    it('should set isDeleted to true', () => {
      task.softDelete('user-002');
      expect(task.isDeleted).toBe(true);
      expect(task.deletedBy).toBe('user-002');
      expect(task.deleteTime).toBeDefined();
    });
  });

  describe('setFeature', () => {
    it('should set feature', () => {
      const feature = { customProp: 'value' };
      task.setFeature(feature);
      expect(task.feature).toEqual(feature);
    });
  });

  describe('getExecutionTime', () => {
    it('should return execution time in milliseconds', async () => {
      task.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      const executionTime = task.getExecutionTime();
      expect(executionTime).toBeGreaterThanOrEqual(90); // Allow 10% tolerance for timing imprecision
    });

    it('should return time until endTime if completed', async () => {
      task.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      task.complete(100);
      const executionTime = task.getExecutionTime();
      expect(executionTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('isCompleted', () => {
    it('should return true when status is COMPLETED', () => {
      task.complete(100);
      expect(task.isCompleted()).toBe(true);
    });

    it('should return true when status is FAILED', () => {
      task.fail('Error');
      expect(task.isCompleted()).toBe(true);
    });

    it('should return false when status is PENDING', () => {
      expect(task.isCompleted()).toBe(false);
    });

    it('should return false when status is RUNNING', () => {
      task.start();
      expect(task.isCompleted()).toBe(false);
    });
  });
});

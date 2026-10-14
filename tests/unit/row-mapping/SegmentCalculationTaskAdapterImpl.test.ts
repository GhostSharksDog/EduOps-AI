import { describe, it, expect } from 'vitest';
import { SegmentCalculationTaskAdapterImpl } from '@/modules/segment/repositories/SegmentCalculationTaskAdapterImpl';
import { POFactory } from '../../helpers/mock-factory';

describe('SegmentCalculationTaskAdapterImpl', () => {
  const adapter = new SegmentCalculationTaskAdapterImpl();

  describe('fromPOToSegmentCalculationTask', () => {
    it('should convert SegmentCalculationTaskPO to entity', () => {
      const taskPO = POFactory.createSegmentCalculationTaskPO({
        id: 'task-1',
        segmentId: 'seg-1',
      });

      const task = adapter.fromPOToSegmentCalculationTask(taskPO as any);

      expect(task.id).toBe('task-1');
      expect(task.segmentId).toBe('seg-1');
    });
  });
});

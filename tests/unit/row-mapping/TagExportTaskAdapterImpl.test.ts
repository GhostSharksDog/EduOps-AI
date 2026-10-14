import { describe, it, expect } from 'vitest';
import { TagExportTaskAdapterImpl } from '@/modules/tag/repositories/TagExportTaskAdapterImpl';
import { POFactory } from '../../helpers/mock-factory';

describe('TagExportTaskAdapterImpl', () => {
  const adapter = new TagExportTaskAdapterImpl();

  describe('fromTagExportTaskPOToTagExportTaskEntity', () => {
    it('should convert TagExportTaskPO to entity', () => {
      const taskPO = POFactory.createTagExportTaskPO({
        id: 'export-1',
        name: 'Test Export',
      });

      const task = adapter.fromTagExportTaskPOToTagExportTaskEntity(taskPO as any);

      expect(task.id).toBe('export-1');
      expect(task.name).toBe('Test Export');
    });
  });
});

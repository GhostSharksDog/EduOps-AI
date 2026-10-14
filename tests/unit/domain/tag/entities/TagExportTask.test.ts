import { describe, it, expect } from 'vitest';
import { TagExportTask } from '@/modules/tag/domain/entities/TagExportTask';
import { ExportTaskStatus } from '@/shared/enums/tag/ExportTaskStatus';

describe('TagExportTask Entity', () => {
  describe('constructor', () => {
    it('should create export task with required fields', () => {
      const task = new TagExportTask(
        'task-001',
        'Export Task',
        'user-001',
        'user-001'
      );

      expect(task.id).toBe('task-001');
      expect(task.name).toBe('Export Task');
      expect(task.ownedBy).toBe('user-001');
      expect(task.createdBy).toBe('user-001');
      expect(task.isDeleted).toBe(false);
      expect(task.createTime).toBeDefined();
    });

    it('should set optional fields', () => {
      const task = new TagExportTask(
        'task-001',
        'Export Task',
        'user-001',
        'user-001',
        'Export description',
        false,
        { customProp: 'value' },
        new Date(),
        undefined,
        undefined,
        undefined,
        undefined,
        { tagIds: ['tag-001'] },
        ExportTaskStatus.COMPLETED,
        1000,
        950,
        '/exports/task-001.csv'
      );

      expect(task.description).toBe('Export description');
      expect(task.status).toBe(ExportTaskStatus.COMPLETED);
      expect(task.totalCount).toBe(1000);
      expect(task.exportedCount).toBe(950);
      expect(task.filePath).toBe('/exports/task-001.csv');
    });

    it('should set errorMessage', () => {
      const task = new TagExportTask(
        'task-001',
        'Export Task',
        'user-001',
        'user-001',
        undefined,
        false,
        undefined,
        new Date(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ExportTaskStatus.FAILED,
        undefined,
        undefined,
        undefined,
        'Export failed due to timeout'
      );

      expect(task.status).toBe(ExportTaskStatus.FAILED);
      expect(task.errorMessage).toBe('Export failed due to timeout');
    });
  });
});

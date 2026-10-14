import { describe, it, expect, beforeEach } from 'vitest';
import { TagExportTaskAdapterImpl } from '@/modules/tag/repositories/TagExportTaskAdapterImpl';
import { TagExportTask } from '@/modules/tag/domain/entities/TagExportTask';
import type { TagExportTaskPO } from '@/modules/tag/repositories/persistence/TagExportTaskPO';
import { ExportTaskStatus } from '@/shared/enums/tag/ExportTaskStatus';

describe('TagExportTaskAdapterImpl', () => {
  let adapter: TagExportTaskAdapterImpl;

  beforeEach(() => {
    adapter = new TagExportTaskAdapterImpl();
  });

  describe('fromTagExportTaskPOToTagExportTaskEntity', () => {
    it('should convert PO to TagExportTask entity with all fields', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Export Task',
        description: 'Export task description',
        ownedBy: 'user-123',
        isDeleted: false,
        feature: { priority: 'high' },
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: new Date('2024-01-02T00:00:00.000Z'),
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: 'user-456',
        deletedBy: null,
        queryParams: { tagId: 'tag-123', filters: [] },
        status: ExportTaskStatus.COMPLETED,
        totalCount: 1000,
        exportedCount: 1000,
        filePath: '/exports/task-123.csv',
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.id).toBe('task-123');
      expect(entity.name).toBe('Export Task');
      expect(entity.description).toBe('Export task description');
      expect(entity.ownedBy).toBe('user-123');
      expect(entity.isDeleted).toBe(false);
      expect(entity.feature).toEqual({ priority: 'high' });
      expect(entity.queryParams).toEqual({ tagId: 'tag-123', filters: [] });
      expect(entity.status).toBe(ExportTaskStatus.COMPLETED);
      expect(entity.totalCount).toBe(1000);
      expect(entity.exportedCount).toBe(1000);
      expect(entity.filePath).toBe('/exports/task-123.csv');
    });

    it('should handle null name with default value', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: null,
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.name).toBe('Export Task');
    });

    it('should handle null createdBy with empty string', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: '',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.createdBy).toBe('');
    });

    it('should handle null description', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.description).toBeUndefined();
    });

    it('should handle feature as string (non-object)', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: 'not-an-object' as any,
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.feature).toEqual({});
    });

    it('should handle feature as array (non-object)', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: ['array'] as any,
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.feature).toEqual({});
    });

    it('should handle queryParams as string (non-object)', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: 'not-an-object' as any,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.queryParams).toBeUndefined();
    });

    it('should handle null queryParams', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.queryParams).toBeUndefined();
    });

    it('should handle null createTime with default Date', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: null as any,
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 0,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.createTime).toBeInstanceOf(Date);
    });

    it('should default totalCount to 0 when not provided', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: null as any,
        exportedCount: 0,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.totalCount).toBe(0);
    });

    it('should default exportedCount to 0 when not provided', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.PENDING,
        totalCount: 100,
        exportedCount: null as any,
        filePath: null,
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.exportedCount).toBe(0);
    });

    it('should handle filePath', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.COMPLETED,
        totalCount: 100,
        exportedCount: 100,
        filePath: '/exports/file.csv',
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.filePath).toBe('/exports/file.csv');
    });

    it('should handle errorMessage', () => {
      const po: TagExportTaskPO = {
        id: 'task-123',
        name: 'Task',
        description: null,
        ownedBy: 'user-123',
        isDeleted: false,
        feature: {},
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: null,
        status: ExportTaskStatus.FAILED,
        totalCount: 100,
        exportedCount: 50,
        filePath: null,
        errorMessage: 'Connection failed'
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(po);

      expect(entity.errorMessage).toBe('Connection failed');
    });
  });

  describe('fromTagExportTaskEntityToTagExportTaskPO', () => {
    it('should convert TagExportTask entity to PO with all fields', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        'user-123',
        'Export task description',
        false,
        { priority: 'high' },
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-01-02T00:00:00.000Z'),
        undefined,
        'user-456',
        undefined,
        { tagId: 'tag-123', filters: [] },
        ExportTaskStatus.COMPLETED,
        1000,
        1000,
        '/exports/task-123.csv',
        undefined
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.id).toBe('task-123');
      expect(po.name).toBe('Export Task');
      expect(po.description).toBe('Export task description');
      expect(po.ownedBy).toBe('user-123');
      expect(po.isDeleted).toBe(false);
      expect(po.feature).toEqual({ priority: 'high' });
      expect(po.queryParams).toEqual({ tagId: 'tag-123', filters: [] });
      expect(po.status).toBe(ExportTaskStatus.COMPLETED);
      expect(po.totalCount).toBe(1000);
      expect(po.exportedCount).toBe(1000);
      expect(po.filePath).toBe('/exports/task-123.csv');
    });

    it('should handle null createdBy', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        null as any,
        undefined,
        false,
        {},
        new Date('2024-01-01T00:00:00.000Z')
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.createdBy).toBeNull();
    });

    it('should handle undefined description as null', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        'user-123',
        undefined,
        false,
        {},
        new Date('2024-01-01T00:00:00.000Z')
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.description).toBeNull();
    });

    it('should handle undefined queryParams as null', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        'user-123',
        undefined,
        false,
        {},
        new Date('2024-01-01T00:00:00.000Z'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ExportTaskStatus.PENDING,
        0,
        0,
        undefined,
        undefined
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.queryParams).toBeNull();
    });

    it('should handle null name', () => {
      const entity = new TagExportTask(
        'task-123',
        null as any,
        'user-123',
        'user-123'
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.name).toBeNull();
    });

    it('should default feature to empty object when undefined', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        'user-123',
        undefined,
        false,
        undefined as any,
        new Date('2024-01-01T00:00:00.000Z')
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.feature).toEqual({});
    });

    it('should default totalCount to 0', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        'user-123',
        undefined,
        false,
        {},
        new Date('2024-01-01T00:00:00.000Z'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ExportTaskStatus.PENDING,
        null as any,
        0,
        undefined,
        undefined
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.totalCount).toBe(0);
    });

    it('should default exportedCount to 0', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        'user-123',
        undefined,
        false,
        {},
        new Date('2024-01-01T00:00:00.000Z'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ExportTaskStatus.PENDING,
        100,
        null as any,
        undefined,
        undefined
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.exportedCount).toBe(0);
    });

    it('should handle null filePath', () => {
      const entity = new TagExportTask(
        'task-123',
        'Export Task',
        'user-123',
        'user-123',
        undefined,
        false,
        {},
        new Date('2024-01-01T00:00:00.000Z'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ExportTaskStatus.PENDING,
        100,
        0,
        undefined,
        undefined
      );

      const po = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(po.filePath).toBeNull();
      expect(po.errorMessage).toBeNull();
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through PO -> Entity -> PO conversion', () => {
      const originalPO: TagExportTaskPO = {
        id: 'task-123',
        name: 'Export Task',
        description: 'Export task description',
        ownedBy: 'user-123',
        isDeleted: false,
        feature: { priority: 'high' },
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: new Date('2024-01-02T00:00:00.000Z'),
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null,
        queryParams: { tagId: 'tag-123' },
        status: ExportTaskStatus.COMPLETED,
        totalCount: 1000,
        exportedCount: 1000,
        filePath: '/exports/file.csv',
        errorMessage: null
      };

      const entity = adapter.fromTagExportTaskPOToTagExportTaskEntity(originalPO);
      const convertedPO = adapter.fromTagExportTaskEntityToTagExportTaskPO(entity);

      expect(convertedPO.id).toBe(originalPO.id);
      expect(convertedPO.name).toBe(originalPO.name);
      expect(convertedPO.ownedBy).toBe(originalPO.ownedBy);
      expect(convertedPO.status).toBe(originalPO.status);
      expect(convertedPO.totalCount).toBe(originalPO.totalCount);
      expect(convertedPO.exportedCount).toBe(originalPO.exportedCount);
      expect(convertedPO.filePath).toBe(originalPO.filePath);
    });
  });
});

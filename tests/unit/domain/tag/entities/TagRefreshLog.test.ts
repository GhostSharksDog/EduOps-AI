import { describe, it, expect, beforeEach } from 'vitest';
import { TagRefreshLog } from '@/modules/tag/domain/entities/TagRefreshLog';

/**
 * TagRefreshLog 实体单元测试
 *
 * 测试覆盖：
 * - fromData 工厂方法
 * - markResolved 状态变更
 * - isSevere 严重错误检测
 * - getErrorSummary 错误摘要
 * - toData 序列化
 * - 边界条件
 */
describe('TagRefreshLog Entity', () => {
  let tagRefreshLog: TagRefreshLog;
  const testDate = new Date('2024-01-01T10:00:00Z');
  const createDate = new Date('2024-01-01T09:00:00Z');

  beforeEach(() => {
    tagRefreshLog = TagRefreshLog.fromData({
      id: 'log-001',
      tagId: 'tag-001',
      mvName: 'mv_user_tags',
      ownedBy: 'tenant-001',
      errorMessage: 'Test error message',
      occurredAt: testDate,
      isResolved: false,
      createTime: createDate,
    });
  });

  describe('fromData', () => {
    it('should create entity from valid data', () => {
      const data = {
        id: 'log-002',
        tagId: 'tag-002',
        mvName: 'mv_segment_tags',
        ownedBy: 'tenant-002',
        errorMessage: 'Connection timeout',
        occurredAt: new Date('2024-02-01'),
        isResolved: true,
        createTime: new Date('2024-02-01'),
      };

      const entity = TagRefreshLog.fromData(data);

      expect(entity.id).toBe(data.id);
      expect(entity.tagId).toBe(data.tagId);
      expect(entity.mvName).toBe(data.mvName);
      expect(entity.errorMessage).toBe(data.errorMessage);
      expect(entity.occurredAt).toBe(data.occurredAt);
      expect(entity.isResolved).toBe(data.isResolved);
      expect(entity.createTime).toBe(data.createTime);
    });

    it('should create entity without errorMessage', () => {
      const entity = TagRefreshLog.fromData({
        id: 'log-003',
        tagId: 'tag-003',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(entity.errorMessage).toBeUndefined();
    });

    it('should preserve all properties', () => {
      const data = tagRefreshLog.toData();
      const restored = TagRefreshLog.fromData(data);

      expect(restored.id).toBe(tagRefreshLog.id);
      expect(restored.tagId).toBe(tagRefreshLog.tagId);
      expect(restored.mvName).toBe(tagRefreshLog.mvName);
      expect(restored.errorMessage).toBe(tagRefreshLog.errorMessage);
      expect(restored.occurredAt).toBe(tagRefreshLog.occurredAt);
      expect(restored.isResolved).toBe(tagRefreshLog.isResolved);
      expect(restored.createTime).toBe(tagRefreshLog.createTime);
    });
  });

  describe('markResolved', () => {
    it('should change isResolved from false to true', () => {
      expect(tagRefreshLog.isResolved).toBe(false);

      tagRefreshLog.markResolved();

      expect(tagRefreshLog.isResolved).toBe(true);
    });

    it('should remain true if already resolved', () => {
      tagRefreshLog.markResolved();
      expect(tagRefreshLog.isResolved).toBe(true);

      tagRefreshLog.markResolved();

      expect(tagRefreshLog.isResolved).toBe(true);
    });

    it('should mutate the entity in place', () => {
      const sameReference = tagRefreshLog;
      sameReference.markResolved();

      expect(tagRefreshLog.isResolved).toBe(true);
    });
  });

  describe('isSevere', () => {
    it('should return true for "stale" keyword', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'Materialized view is stale',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(true);
    });

    it('should return true for "failed" keyword', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'Refresh operation failed',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(true);
    });

    it('should return true for "error" keyword', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'An error occurred during refresh',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(true);
    });

    it('should return true for "exception" keyword', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'Unexpected exception thrown',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(true);
    });

    it('should return true for uppercase keywords', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'ERROR: Something went wrong',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(true);
    });

    it('should return true for mixed case keywords', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'ExCePtIoN detected',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(true);
    });

    it('should return false for non-severe messages', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'Warning: slow query detected',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(false);
    });

    it('should return false for undefined errorMessage', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(false);
    });

    it('should return false for empty errorMessage', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: '',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.isSevere()).toBe(false);
    });
  });

  describe('getErrorSummary', () => {
    it('should return full message when under 200 characters', () => {
      const shortMessage = 'Short error message';
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: shortMessage,
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.getErrorSummary()).toBe(shortMessage);
    });

    it('should return full message when exactly 200 characters', () => {
      const exactMessage = 'a'.repeat(200);
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: exactMessage,
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.getErrorSummary()).toBe(exactMessage);
      expect(log.getErrorSummary().length).toBe(200);
    });

    it('should truncate message over 200 characters and add ellipsis', () => {
      const longMessage = 'a'.repeat(250);
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: longMessage,
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      const summary = log.getErrorSummary();

      expect(summary.length).toBe(203); // 200 + 3 for '...'
      expect(summary).toBe('a'.repeat(200) + '...');
    });

    it('should return "未知错误" for undefined errorMessage', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.getErrorSummary()).toBe('未知错误');
    });

    it('should return "未知错误" for empty errorMessage', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: '',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      expect(log.getErrorSummary()).toBe('未知错误');
    });

    it('should preserve message content in first 200 characters', () => {
      const longMessage =
        'Database connection failed: timeout after 30s. Retrying... Connection pool exhausted. ' +
        'Unable to acquire connection from pool. All connections are busy. ' +
        'Please check your database configuration and connection limits.';
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: longMessage,
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      const summary = log.getErrorSummary();

      expect(summary.startsWith(longMessage.substring(0, 200))).toBe(true);
      expect(summary.endsWith('...')).toBe(true);
    });
  });

  describe('toData', () => {
    it('should serialize entity to plain object', () => {
      const data = tagRefreshLog.toData();

      expect(data).toEqual({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_user_tags',
      ownedBy: 'tenant-001',
        errorMessage: 'Test error message',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });
    });

    it('should include undefined errorMessage in output', () => {
      const log = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      const data = log.toData();

      expect(data.errorMessage).toBeUndefined();
    });

    it('should reflect changes after markResolved', () => {
      tagRefreshLog.markResolved();

      const data = tagRefreshLog.toData();

      expect(data.isResolved).toBe(true);
    });
  });

  describe('fromData and toData round trip', () => {
    it('should preserve all data through serialization cycle', () => {
      const original = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        errorMessage: 'Test error',
        occurredAt: testDate,
        isResolved: true,
        createTime: createDate,
      });

      const data = original.toData();
      const restored = TagRefreshLog.fromData(data);

      expect(restored.toData()).toEqual(data);
    });

    it('should work with entity that has no errorMessage', () => {
      const original = TagRefreshLog.fromData({
        id: 'log-001',
        tagId: 'tag-001',
        mvName: 'mv_test',
        ownedBy: 'tenant-001',
        occurredAt: testDate,
        isResolved: false,
        createTime: createDate,
      });

      const data = original.toData();
      const restored = TagRefreshLog.fromData(data);

      expect(restored.toData()).toEqual(data);
      expect(restored.errorMessage).toBeUndefined();
    });
  });

  describe('constructor defaults', () => {
    it('should use default values for optional parameters', () => {
      const now = new Date();
      const log = new TagRefreshLog('id-1', 'tag-1', 'mv_name', 'tenant-001');

      expect(log.id).toBe('id-1');
      expect(log.tagId).toBe('tag-1');
      expect(log.mvName).toBe('mv_name');
      expect(log.errorMessage).toBeUndefined();
      expect(log.isResolved).toBe(false);
      // Check that dates are recent (within 1 second)
      expect(Math.abs(log.occurredAt.getTime() - now.getTime())).toBeLessThan(1000);
      expect(Math.abs(log.createTime.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it('should accept explicit values for all parameters', () => {
      const occurredAt = new Date('2024-03-01');
      const createTime = new Date('2024-03-02');
      const log = new TagRefreshLog(
        'id-1',
        'tag-1',
        'mv_name',
        'tenant-1',
        'Error message',
        occurredAt,
        true,
        createTime
      );

      expect(log.id).toBe('id-1');
      expect(log.tagId).toBe('tag-1');
      expect(log.mvName).toBe('mv_name');
      expect(log.ownedBy).toBe('tenant-1');
      expect(log.errorMessage).toBe('Error message');
      expect(log.occurredAt).toBe(occurredAt);
      expect(log.isResolved).toBe(true);
      expect(log.createTime).toBe(createTime);
    });
  });
});

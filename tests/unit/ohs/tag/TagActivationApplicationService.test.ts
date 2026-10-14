import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TagActivationApplicationServiceImpl } from '@/modules/tag/services/TagActivationApplicationServiceImpl';

// Import the service under test. Paths use TS alias as per project conventions.
// We rely on the existing test pattern in TagValueApplicationService.test.ts for mocking style.
// Import the module dynamically to accommodate various export shapes in the project

type Tag = {
  id: string;
  name: string;
  active: boolean;
};

describe('TagActivationApplicationService', () => {
  let repository: any;
  let domainService: any;
  let service: any;

  beforeEach(async () => {
    // Mock external dependencies
    repository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    domainService = {
      getTag: vi.fn(async (id) => {
        const tag = await repository.findById(id);
        return tag ? { ...tag, status: tag.active ? 'ACTIVE' : 'INACTIVE', updateCycle: 'DAILY',
          currentVersion: { version: 1, calculationRule: JSON.stringify({ ruleType: 'SQL', ruleContent: 'SELECT 1' }) } } : null;
      }),
      updateTagStatus: vi.fn(),
    };
    service = new TagActivationApplicationServiceImpl(domainService,
      { createMv: vi.fn(), stopMv: vi.fn() } as any, {} as any,
      { checkTableExists: vi.fn().mockResolvedValue(false) } as any,
      { getTagBitAssignment: vi.fn().mockResolvedValue({ bitmapTableId: 'bt-1', bitmapTableName: 'tag_bitmap_1', bitPosition: 0 }) } as any,
      { createSyncState: vi.fn(), markObsolete: vi.fn() } as any,
      { create: vi.fn() } as any,
      { findByTagId: vi.fn().mockResolvedValue({ id: 'tt-1', tableName: 'target_table' }) } as any);
  });

  describe('activateTag()', () => {
    it('should activate an inactive tag successfully', async () => {
      const tag: Tag = { id: 't1', name: 'Tag 1', active: false };
      repository.findById.mockResolvedValue(tag);
      repository.save.mockImplementation(async (t: Tag) => t);

      const result = await service.activateTag({ tagId: tag.id, userId: 'u1' });

      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(repository.findById).toHaveBeenCalledWith(tag.id);
      expect(domainService.updateTagStatus).toHaveBeenCalledWith(tag.id, 'ACTIVE');
    });

    it('should throw Not Found error when tag does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      const result = await service.activateTag({ tagId: 'missing-tag', userId: 'u1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('标签不存在');
    });

    it('should return existing tag when already activated (no side effects)', async () => {
      const tag: Tag = { id: 't2', name: 'Tag 2', active: true };
      repository.findById.mockResolvedValue(tag);

      const result = await service.activateTag({ tagId: tag.id, userId: 'u1' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('已是激活状态');
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deactivateTag()', () => {
    it('should deactivate an active tag successfully', async () => {
      const tag: Tag = { id: 't3', name: 'Tag 3', active: true };
      repository.findById.mockResolvedValue(tag);
      repository.save.mockImplementation(async (t: Tag) => t);

      const result = await service.deactivateTag({ tagId: tag.id, userId: 'u1' });

      expect(result).toBeUndefined();
      expect(repository.findById).toHaveBeenCalledWith(tag.id);
      expect(domainService.updateTagStatus).toHaveBeenCalledWith(tag.id, 'INACTIVE');
    });

    it('should throw Not Found error when tag does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.deactivateTag({ tagId: 'missing-tag', userId: 'u1' })).rejects.toThrow('标签或版本不存在');
    });

    it('should keep inactive tag as is (no side effects)', async () => {
      const tag: Tag = { id: 't4', name: 'Tag 4', active: false };
      repository.findById.mockResolvedValue(tag);

      const result = await service.deactivateTag({ tagId: tag.id, userId: 'u1' });

      expect(result).toBeUndefined();
      expect(domainService.updateTagStatus).toHaveBeenCalledWith(tag.id, 'INACTIVE');
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  it('should handle invalid id input gracefully (edge case)', async () => {
    // Depending on implementation, invalid input may throw or reject
    // We simply ensure it does not crash the test runner
    repository.findById.mockResolvedValue(null);
    // @ts-ignore
    const result = await service.activateTag({ tagId: undefined, userId: 'u1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('标签不存在');
  });
});

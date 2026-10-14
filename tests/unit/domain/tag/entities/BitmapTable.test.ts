import { describe, it, expect, beforeEach } from 'vitest';
import { BitmapTable } from '@/modules/tag/domain/entities/BitmapTable';

 
describe('BitmapTable Entity', () => {
  let bitmapTable: BitmapTable;

  beforeEach(() => {
    bitmapTable = BitmapTable.fromData({
      id: 'test-id',
      entityType: 'user',
      entityTypeId: 'entity-type-001',
      ownedBy: 'tenant-001',
      sequence: 1,
      totalBits: 64,
      usedBits: [],
      status: 'ACTIVE',
      createTime: new Date('2024-01-01'),
    });
  });

  describe('allocateBit', () => {
    it('should allocate first bit when no bits used', () => {
      const result = bitmapTable.allocateBit();
      expect(result).toBe(0);
      expect(bitmapTable.isBitUsed(0)).toBe(true);
      expect(bitmapTable.getUsedBitCount()).toBe(1);
    });

    it('should allocate smallest available bit', () => {
      bitmapTable.allocateBit();
 // 0
      bitmapTable.allocateBit(); // 1
      bitmapTable.releaseBit(1);
      const result = bitmapTable.allocateBit();
      expect(result).toBe(1);
      expect(bitmapTable.isBitUsed(1)).toBe(true);
    });

    it('should allocate last bit correctly', () => {
      for (let i = 0; i < 63; i++) {
        bitmapTable.allocateBit();
      }
      expect(bitmapTable.getUsedBitCount()).toBe(63);
      
      const result = bitmapTable.allocateBit();
      expect(result).toBe(63);
      expect(bitmapTable.getUsedBitCount()).toBe(64);
      expect(bitmapTable.hasAvailableBit()).toBe(false);
    });

    it('should return null when all bits used', () => {
      for (let i = 0; i < 64; i++) {
        bitmapTable.allocateBit();
      }
      const result = bitmapTable.allocateBit();
      expect(result).toBeNull();
    });

    it('should keep usedBits sorted', () => {
      bitmapTable.allocateBit(); // 0
      bitmapTable.allocateBit(); // 1
      bitmapTable.allocateBit(); // 2
      bitmapTable.releaseBit(0);
      bitmapTable.allocateBit();
      const data = bitmapTable.toData();
      expect(data.usedBits).toEqual([0, 1, 2]);
    });

    it('should find middle gap when bits are sparse', () => {
      bitmapTable.allocateBit(); // 0
      bitmapTable.allocateBit(); // 1
      bitmapTable.allocateBit(); // 2
      bitmapTable.allocateBit(); // 3
      bitmapTable.releaseBit(1);
      bitmapTable.releaseBit(2);
      const result = bitmapTable.allocateBit();
      expect(result).toBe(1);
    });
  });

  describe('releaseBit', () => {
    it('should release used bit', () => {
      bitmapTable.allocateBit();
      expect(bitmapTable.getUsedBitCount()).toBe(1);
      
      bitmapTable.releaseBit(0);
      expect(bitmapTable.isBitUsed(0)).toBe(false);
      expect(bitmapTable.getUsedBitCount()).toBe(0);
    });

    it('should silently skip release when bit not used', () => {
      bitmapTable.allocateBit();
      bitmapTable.releaseBit(999);
      expect(bitmapTable.getUsedBitCount()).toBe(1);
    });

    it('should handle multiple releaseses', () => {
      for (let i = 0; i < 5; i++) {
        bitmapTable.allocateBit();
      }
      expect(bitmapTable.getUsedBitCount()).toBe(5);
      
      bitmapTable.releaseBit(2);
      bitmapTable.releaseBit(4);
      expect(bitmapTable.getUsedBitCount()).toBe(3);
      expect(bitmapTable.isBitUsed(2)).toBe(false);
      expect(bitmapTable.isBitUsed(4)).toBe(false);
    });
  });

  describe('isValidBitPosition', () => {
    it('should return false for negative bit', () => {
      expect(bitmapTable.isValidBitPosition(-1)).toBe(false);
    });

    it('should return false for bit >= totalBits', () => {
      expect(bitmapTable.isValidBitPosition(64)).toBe(false);
      expect(bitmapTable.isValidBitPosition(100)).toBe(false);
    });

    it('should return true for valid bit', () => {
      expect(bitmapTable.isValidBitPosition(0)).toBe(true);
      expect(bitmapTable.isValidBitPosition(63)).toBe(true);
      expect(bitmapTable.isValidBitPosition(32)).toBe(true);
    });

    it('should respect custom totalBits', () => {
      const smallTable = BitmapTable.fromData({
        id: 'small',
        entityType: 'test',
        entityTypeId: 'entity-type-002',
        ownedBy: 'tenant-001',
        sequence: 1,
        totalBits: 16,
        usedBits: [],
        status: 'ACTIVE',
        createTime: new Date(),
      });
      
      expect(smallTable.isValidBitPosition(15)).toBe(true);
      expect(smallTable.isValidBitPosition(16)).toBe(false);
    });
  });

  describe('hasAvailableBit', () => {
    it('should return true when bits available', () => {
      expect(bitmapTable.hasAvailableBit()).toBe(true);
    });

    it('should return false when all bits used', () => {
      for (let i = 0; i < 64; i++) {
        bitmapTable.allocateBit();
      }
      expect(bitmapTable.hasAvailableBit()).toBe(false);
    });

    it('should return true when partially used', () => {
      for (let i = 0; i < 63; i++) {
        bitmapTable.allocateBit();
      }
      expect(bitmapTable.hasAvailableBit()).toBe(true);
    });
  });

  describe('isBitUsed', () => {
    it('should return false for unused bit', () => {
      expect(bitmapTable.isBitUsed(0)).toBe(false);
      expect(bitmapTable.isBitUsed(5)).toBe(false);
    });

    it('should return true for used bit', () => {
      bitmapTable.allocateBit();
      expect(bitmapTable.isBitUsed(0)).toBe(true);
      expect(bitmapTable.isBitUsed(1)).toBe(false);
    });

    it('should update after release', () => {
      bitmapTable.allocateBit();
      expect(bitmapTable.isBitUsed(0)).toBe(true);
      
      bitmapTable.releaseBit(0);
      expect(bitmapTable.isBitUsed(0)).toBe(false);
    });
  });

  describe('getAvailableBitCount', () => {
    it('should return totalBits when none used', () => {
      expect(bitmapTable.getAvailableBitCount()).toBe(64);
    });

    it('should decrease after allocation', () => {
      bitmapTable.allocateBit();
      expect(bitmapTable.getAvailableBitCount()).toBe(63);
      
      bitmapTable.allocateBit();
      expect(bitmapTable.getAvailableBitCount()).toBe(62);
    });

    it('should increase after release', () => {
      bitmapTable.allocateBit();
      bitmapTable.allocateBit();
      expect(bitmapTable.getAvailableBitCount()).toBe(62);
      
      bitmapTable.releaseBit(0);
      expect(bitmapTable.getAvailableBitCount()).toBe(63);
    });

    it('should return 0 when all used', () => {
      for (let i = 0; i < 64; i++) {
        bitmapTable.allocateBit();
      }
      expect(bitmapTable.getAvailableBitCount()).toBe(0);
    });
  });

  describe('getUsedBitCount', () => {
    it('should return 0 when none used', () => {
      expect(bitmapTable.getUsedBitCount()).toBe(0);
    });

    it('should increase after allocation', () => {
      bitmapTable.allocateBit();
      expect(bitmapTable.getUsedBitCount()).toBe(1);
    });

    it('should decrease after release', () => {
      bitmapTable.allocateBit();
      bitmapTable.releaseBit(0);
      expect(bitmapTable.getUsedBitCount()).toBe(0);
    });
  });

  describe('peekNextAvailableBit', () => {
    it('should return 0 when no bits used', () => {
      expect(bitmapTable.peekNextAvailableBit()).toBe(0);
    });

    it('should not allocate the bit', () => {
      const result = bitmapTable.peekNextAvailableBit();
      expect(result).toBe(0);
      expect(bitmapTable.getUsedBitCount()).toBe(0);
      expect(bitmapTable.isBitUsed(0)).toBe(false);
    });

    it('should return null when all bits used', () => {
      for (let i = 0; i < 64; i++) {
        bitmapTable.allocateBit();
      }
      expect(bitmapTable.peekNextAvailableBit()).toBeNull();
    });

    it('should find gap in used bits', () => {
      bitmapTable.allocateBit(); // 0
      bitmapTable.allocateBit(); // 1
      bitmapTable.allocateBit(); // 2
      bitmapTable.releaseBit(1);
      
      expect(bitmapTable.peekNextAvailableBit()).toBe(1);
    });
  });

  describe('边界条件', () => {
    it('should handle bit 0 correctly', () => {
      const result = bitmapTable.allocateBit();
      expect(result).toBe(0);
      expect(bitmapTable.isBitUsed(0)).toBe(true);
      expect(bitmapTable.isValidBitPosition(0)).toBe(true);
    });

    it('should handle bit 63 (last) correctly', () => {
      for (let i = 0; i < 63; i++) {
        bitmapTable.allocateBit();
      }
      
      const result = bitmapTable.allocateBit();
      expect(result).toBe(63);
      expect(bitmapTable.isBitUsed(63)).toBe(true);
      expect(bitmapTable.getAvailableBitCount()).toBe(0);
      expect(bitmapTable.hasAvailableBit()).toBe(false);
    });

    it('should handle all bits allocation and release cycle', () => {
      const allocatedBits: number[] = [];
      for (let i = 0; i < 64; i++) {
        const bit = bitmapTable.allocateBit();
        expect(bit).not.toBeNull();
        allocatedBits.push(bit!);
      }
      
      expect(bitmapTable.allocateBit()).toBeNull();
      
      for (const bit of allocatedBits) {
        bitmapTable.releaseBit(bit);
      }
      
      expect(bitmapTable.hasAvailableBit()).toBe(true);
      expect(bitmapTable.getAvailableBitCount()).toBe(64);
    });
  });

  describe('fromData and toData', () => {
    it('should create entity from data', () => {
      const data = {
        id: 'test-123',
        entityType: 'product',
        entityTypeId: 'entity-type-003',
        ownedBy: 'tenant-001',
        sequence: 1,
        totalBits: 32,
        usedBits: [0, 1, 2],
        status: 'ACTIVE',
        createTime: new Date('2024-01-01'),
        updateTime: new Date('2024-01-02'),
      };
      
      const entity = BitmapTable.fromData(data);
      
      expect(entity.id).toBe(data.id);
      expect(entity.entityType).toBe(data.entityType);
      expect(entity.entityTypeId).toBe(data.entityTypeId);
      expect(entity.ownedBy).toBe(data.ownedBy);
      expect(entity.sequence).toBe(data.sequence);
      expect(entity.totalBits).toBe(data.totalBits);
      expect(entity.usedBits).toEqual(data.usedBits);
      expect(entity.status).toBe(data.status);
      expect(entity.createTime).toBe(data.createTime);
      expect(entity.updateTime).toBe(data.updateTime);
    });

    it('should convert to data and back', () => {
      bitmapTable.allocateBit();
      bitmapTable.allocateBit();
      
      const data = bitmapTable.toData();
      const restored = BitmapTable.fromData(data);
      
      expect(restored.toData()).toEqual(data);
    });
  });
});

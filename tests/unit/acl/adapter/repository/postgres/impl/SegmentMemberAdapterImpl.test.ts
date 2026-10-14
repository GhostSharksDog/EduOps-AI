import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentMemberAdapterImpl } from '@/modules/segment/repositories/SegmentMemberAdapterImpl';
import { SegmentMember } from '@/modules/segment/domain/index';
import { JoinMethod } from '@/shared/enums/index';

describe('SegmentMemberAdapterImpl', () => {
  let adapter: SegmentMemberAdapterImpl;

  beforeEach(() => {
    adapter = new SegmentMemberAdapterImpl();
  });

  describe('fromPOToSegmentMemberDomain', () => {
    it('should convert PO to SegmentMember entity with all fields', () => {
      const po = {
        id: 'member-123',
        segmentId: 'segment-123',
        memberId: 'entity-123',
        joinMethod: JoinMethod.MANUAL,
        joinTime: new Date('2024-01-01T00:00:00Z'),
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01T00:00:00Z'),
        createdBy: 'user-123',
        isDeleted: false,
        feature: 'default',
        updateTime: new Date('2024-01-02T00:00:00Z')
      };

      const entity = adapter.fromPOToSegmentMemberDomain(po as any);

      expect(entity.id).toBe('member-123');
      expect(entity.segmentId).toBe('segment-123');
      expect(entity.memberId).toBe('entity-123');
      expect(entity.joinMethod).toBe(JoinMethod.MANUAL);
      expect(entity.isActive).toBe(true);
    });

    it('should derive isActive from isDeleted', () => {
      const po = {
        id: 'member-123',
        segmentId: 'segment-123',
        memberId: 'entity-123',
        joinMethod: JoinMethod.MANUAL,
        joinTime: new Date(),
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        isDeleted: true,
        feature: 'default'
      };

      const entity = adapter.fromPOToSegmentMemberDomain(po as any);

      expect(entity.isActive).toBe(false);
    });

    it('should default joinMethod to MANUAL when not specified', () => {
      const po = {
        id: 'member-123',
        segmentId: 'segment-123',
        memberId: 'entity-123',
        joinMethod: null,
        joinTime: null,
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        isDeleted: false,
        feature: 'default'
      };

      const entity = adapter.fromPOToSegmentMemberDomain(po as any);

      expect(entity.joinMethod).toBe(JoinMethod.MANUAL);
    });

    it('should use current date when joinTime is null', () => {
      const po = {
        id: 'member-123',
        segmentId: 'segment-123',
        memberId: 'entity-123',
        joinMethod: JoinMethod.MANUAL,
        joinTime: null,
        ownedBy: 'user-123',
        createTime: null,
        createdBy: 'user-123',
        isDeleted: false,
        feature: 'default'
      };

      const beforeDate = new Date();
      const entity = adapter.fromPOToSegmentMemberDomain(po as any);
      const afterDate = new Date();

      expect(entity.joinedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime() - 1000);
      expect(entity.joinedAt.getTime()).toBeLessThanOrEqual(afterDate.getTime() + 1000);
    });

    it('should default isDeleted to false when not specified', () => {
      const po = {
        id: 'member-123',
        segmentId: 'segment-123',
        memberId: 'entity-123',
        joinMethod: JoinMethod.MANUAL,
        joinTime: new Date(),
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        feature: 'default'
      };

      const entity = adapter.fromPOToSegmentMemberDomain(po as any);

      expect(entity.isActive).toBe(true);
    });
  });

  describe('fromSegmentMemberDomainToPO', () => {
    it('should convert SegmentMember entity to PO', () => {
      const entity = new SegmentMember(
        'member-123',
        'segment-123',
        'entity-123',
        JoinMethod.MANUAL,
        new Date('2024-01-01T00:00:00Z'),
        'user-123',
        new Date('2024-01-01T00:00:00Z'),
        'user-123',
        undefined,
        false,
        'default'
      );

      const po = adapter.fromSegmentMemberDomainToPO(entity);

      expect(po.id).toBe('member-123');
      expect(po.segmentId).toBe('segment-123');
      expect(po.memberId).toBe('entity-123');
      expect(po.joinMethod).toBe(JoinMethod.MANUAL.toString());
    });

    it('should map joinedAt to joinTime field', () => {
      const joinTime = new Date('2024-01-01T00:00:00Z');
      const entity = new SegmentMember(
        'member-123',
        'segment-123',
        'entity-123',
        JoinMethod.MANUAL,
        joinTime,
        'user-123',
        new Date(),
        'user-123',
        undefined,
        false,
        'default'
      );

      const po = adapter.fromSegmentMemberDomainToPO(entity);

      expect(po.joinTime).toEqual(joinTime);
    });
  });
});

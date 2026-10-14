import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentMember } from '@/modules/segment/domain/entities/SegmentMember';
import { JoinMethod } from '@/shared/enums/index';

describe('SegmentMember Entity', () => {
  let member: SegmentMember;

  beforeEach(() => {
    member = new SegmentMember(
      'member-001',
      'segment-001',
      'entity-001',
      JoinMethod.RULE,
      new Date(),
      'user-001',
      new Date(),
      'user-001'
    );
  });

  describe('constructor', () => {
    it('should create member with required fields', () => {
      expect(member.id).toBe('member-001');
      expect(member.segmentId).toBe('segment-001');
      expect(member.memberId).toBe('entity-001');
      expect(member.joinMethod).toBe(JoinMethod.RULE);
      expect(member.joinedAt).toBeDefined();
      expect(member.ownedBy).toBe('user-001');
      expect(member.isDeleted).toBe(false);
      expect(member.isActive).toBe(true);
    });
  });

  describe('markAsLeft', () => {
    it('should set isActive to false and set leaveTime', () => {
      member.markAsLeft();
      expect(member.isActive).toBe(false);
      expect(member.leaveTime).toBeDefined();
    });
  });

  describe('softDelete', () => {
    it('should set isDeleted to true', () => {
      member.softDelete('user-002');
      expect(member.isDeleted).toBe(true);
      expect(member.deletedBy).toBe('user-002');
      expect(member.deleteTime).toBeDefined();
    });
  });

  describe('restore', () => {
    it('should restore deleted member', () => {
      member.softDelete('user-002');
      member.restore();
      expect(member.isDeleted).toBe(false);
      expect(member.deleteTime).toBeUndefined();
      expect(member.deletedBy).toBeUndefined();
    });
  });

  describe('setFeature', () => {
    it('should set feature', () => {
      const feature = { customProp: 'value' };
      member.setFeature(feature);
      expect(member.feature).toEqual(feature);
    });
  });

  describe('isValidMember', () => {
    it('should return true when active and not deleted', () => {
      expect(member.isValidMember()).toBe(true);
    });

    it('should return false when inactive', () => {
      member.markAsLeft();
      expect(member.isValidMember()).toBe(false);
    });

    it('should return false when deleted', () => {
      member.softDelete('user-002');
      expect(member.isValidMember()).toBe(false);
    });
  });
});

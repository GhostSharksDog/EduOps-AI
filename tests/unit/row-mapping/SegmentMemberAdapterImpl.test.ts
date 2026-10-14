import { describe, it, expect } from 'vitest';
import { SegmentMemberAdapterImpl } from '@/modules/segment/repositories/SegmentMemberAdapterImpl';
import { POFactory } from '../../helpers/mock-factory';

describe('SegmentMemberAdapterImpl', () => {
  const adapter = new SegmentMemberAdapterImpl();

  describe('fromPOToSegmentMemberDomain', () => {
    it('should convert SegmentMemberPO to SegmentMember entity', () => {
      const memberPO = POFactory.createSegmentMemberPO({
        id: 'member-1',
        segmentId: 'seg-1',
        entityId: 'entity-1',
      });

      const member = adapter.fromPOToSegmentMemberDomain(memberPO as any);

      expect(member.id).toBe('member-1');
      expect(member.segmentId).toBe('seg-1');
    });
  });
});

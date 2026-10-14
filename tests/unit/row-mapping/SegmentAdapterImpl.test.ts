import { describe, it, expect } from 'vitest';
import { SegmentAdapterImpl } from '@/modules/segment/repositories/SegmentAdapterImpl';
import { MockFactory } from '../../helpers/mock-factory';

describe('SegmentAdapterImpl', () => {
  const adapter = new SegmentAdapterImpl();

  describe('fromPOToSegment', () => {
    it('should convert SegmentPO to Segment entity', () => {
      const segmentPO = MockFactory.createSegmentPO({
        id: 'seg-1',
        name: 'Test Segment',
      });

      const segment = adapter.fromPOToSegment(segmentPO as any);

      expect(segment.id).toBe('seg-1');
      expect(segment.name).toBe('Test Segment');
    });

    it('should handle null description', () => {
      const segmentPO = MockFactory.createSegmentPO({
        id: 'seg-2',
        name: 'No Description Segment',
        description: null,
      });

      const segment = adapter.fromPOToSegment(segmentPO as any);

      expect(segment.id).toBe('seg-2');
      expect(segment.description).toBeUndefined();
    });

    it('should handle different status values', () => {
      const statusValues = ['DRAFT', 'ACTIVE', 'ARCHIVED', 'ERROR'];
      
      for (const status of statusValues) {
        const segmentPO = MockFactory.createSegmentPO({
          id: `seg-${status.toLowerCase()}`,
          name: `${status} Segment`,
          status,
        });

        const segment = adapter.fromPOToSegment(segmentPO as any);

        expect(segment.status).toBe(status);
      }
    });

    it('should handle deleted segment', () => {
      const segmentPO = MockFactory.createSegmentPO({
        id: 'seg-deleted',
        name: 'Deleted Segment',
        isDeleted: true,
      });

      const segment = adapter.fromPOToSegment(segmentPO as any);

      expect(segment.isDeleted).toBe(true);
    });

    it('should restore the member count from a confirmed risk snapshot', () => {
      const segmentPO = MockFactory.createSegmentPO({
        id: 'seg-members',
        name: 'Segment with Members',
        feature: { engine: 'education-attendance-v1', memberCount: 1000 },
      });

      const segment = adapter.fromPOToSegment(segmentPO as any);

      expect(segment.memberCount).toBe(1000);
    });

    it('should not treat generic metadata as a completed calculation', () => {
      const segmentPO = MockFactory.createSegmentPO({
        feature: { metadata: { memberCount: 1000 } },
      });
      const segment = adapter.fromPOToSegment(segmentPO as any);
      expect(segment.memberCount).toBe(0);
    });  });
});



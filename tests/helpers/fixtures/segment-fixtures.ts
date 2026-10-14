import { Segment } from '@/modules/segment/domain/entities/Segment';
import { SegmentStatus, SegmentType, SegmentCalculationType, SegmentCalculationPeriod } from '@/shared/enums/index';
import { TEST_USER_ID, generateTestUuid } from '../constants';

export function createTestSegment(overrides: Partial<{
  id: string;
  name: string;
  ownedBy: string;
  createdBy: string;
  description: string;
  type: SegmentType;
  status: SegmentStatus;
}> = {}): Segment {
  return new Segment(
    overrides.id ?? generateTestUuid(),
    overrides.name ?? 'Test Segment',
    overrides.ownedBy ?? TEST_USER_ID,
    new Date('2024-01-01T00:00:00Z'),
    overrides.createdBy ?? TEST_USER_ID,
    overrides.description,
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    overrides.type ?? SegmentType.STATIC,
    overrides.status ?? SegmentStatus.DRAFT,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    0,
    undefined,
    undefined
  );
}

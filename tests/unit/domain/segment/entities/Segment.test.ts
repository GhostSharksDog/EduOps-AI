import { describe, it, expect, beforeEach } from 'vitest';
import { Segment } from '@/modules/segment/domain/entities/Segment';
import { SegmentStatus } from '@/shared/enums/index';
import { SegmentConditionGroup, SegmentMetadata, SegmentStatistics } from '@/modules/segment/domain/value-objects/index';

describe('Segment Entity', () => {
  let segment: Segment;

  beforeEach(() => {
    segment = new Segment(
      'segment-001',
      'Test Segment',
      'user-001',
      new Date(),
      'user-001',
      'Test description'
    );
  });

  describe('constructor', () => {
    it('should create segment with required fields', () => {
      expect(segment.id).toBe('segment-001');
      expect(segment.name).toBe('Test Segment');
      expect(segment.ownedBy).toBe('user-001');
      expect(segment.isDeleted).toBe(false);
    });

    it('should set optional fields', () => {
      expect(segment.description).toBe('Test description');
    });
  });

  describe('changeStatus', () => {
    it('should update status and timestamps', () => {
      segment.changeStatus(SegmentStatus.ACTIVE);
      expect(segment.status).toBe(SegmentStatus.ACTIVE);
      expect(segment.updateTime).toBeDefined();
    });
  });

  describe('updateConditions', () => {
    it('should update conditionGroup', () => {
      const conditions: SegmentConditionGroup = {
        logic: 'AND',
        conditions: []
      } as unknown as SegmentConditionGroup;

      segment.updateConditions(conditions);
      expect(segment.conditionGroup).toEqual(conditions);
      expect(segment.updateTime).toBeDefined();
    });
  });

  describe('updateStatistics', () => {
    it('should update statistics', () => {
      const stats: SegmentStatistics = {
        totalMembers: 100
      } as SegmentStatistics;

      segment.updateStatistics(stats);
      expect(segment.statistics).toEqual(stats);
      expect(segment.updateTime).toBeDefined();
    });
  });

  describe('updateMemberCount', () => {
    it('should update memberCount', () => {
      segment.updateMemberCount(200);
      expect(segment.memberCount).toBe(200);
      expect(segment.updateTime).toBeDefined();
    });
  });

  describe('updateCalculationTime', () => {
    it('should update calculation times', () => {
      const lastTime = new Date('2024-01-01');
      const nextTime = new Date('2024-02-01');

      segment.updateCalculationTime(lastTime, nextTime);
      expect(segment.lastCalculationTime).toBe(lastTime);
      expect(segment.nextCalculationTime).toBe(nextTime);
      expect(segment.updateTime).toBeDefined();
    });
  });

  describe('setFeature', () => {
    it('should set feature', () => {
      const feature = { customProp: 'value' };
      segment.setFeature(feature);
      expect(segment.feature).toEqual(feature);
      expect(segment.updateTime).toBeDefined();
    });
  });

  describe('setScheduleConfig', () => {
    it('should set scheduleConfig', () => {
      const config = { frequency: 'daily' };
      segment.setScheduleConfig(config);
      expect(segment.scheduleConfig).toEqual(config);
      expect(segment.updateTime).toBeDefined();
    });
  });

  describe('activate', () => {
    it('should activate segment from DRAFT status', () => {
      segment.status = SegmentStatus.DRAFT;
      segment.activate('user-002');
      expect(segment.status).toBe(SegmentStatus.ACTIVE);
      expect(segment.updatedBy).toBe('user-002');
      expect(segment.updateTime).toBeDefined();
    });

    it('should throw error if not in DRAFT status', () => {
      segment.status = SegmentStatus.ACTIVE;
      expect(() => segment.activate('user-002')).toThrow();
    });
  });

  describe('deactivate', () => {
    it('should deactivate segment from ACTIVE status', () => {
      segment.status = SegmentStatus.ACTIVE;
      segment.deactivate('user-002');
      expect(segment.status).toBe(SegmentStatus.INACTIVE);
      expect(segment.updatedBy).toBe('user-002');
      expect(segment.updateTime).toBeDefined();
    });

    it('should throw error if not in ACTIVE status', () => {
      segment.status = SegmentStatus.DRAFT;
      expect(() => segment.deactivate('user-002')).toThrow();
    });
  });

  describe('markAsCalculating', () => {
    it('should set status to CALCULATING', () => {
      segment.markAsCalculating();
      expect(segment.status).toBe(SegmentStatus.CALCULATING);
      expect(segment.updateTime).toBeDefined();
    });
  });
});

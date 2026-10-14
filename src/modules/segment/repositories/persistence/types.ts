export type {SegmentRow as Segment,SegmentConditionRow as SegmentCondition,SegmentTaskRow as SegmentCalculationTask,SegmentMemberRow as SegmentMember} from '../row-types';
export type UUID=string;
export type JSONB=import('@/shared/types/feature').Feature;
export type Timestamp=Date;
export {SegmentCalculationStatus,SegmentConditionOperator,SegmentConditionType,SegmentStatus} from '@/shared/enums';

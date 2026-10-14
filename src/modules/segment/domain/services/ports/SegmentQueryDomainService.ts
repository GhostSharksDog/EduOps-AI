import {Segment} from '@/modules/segment/domain/entities/index';
import {SegmentFilter} from '@/modules/segment/domain/commands/SegmentFilter';
import {SegmentType} from '@/shared/enums/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export interface SegmentCompareResult {
    id: string;
    name: string;
    type: SegmentType | undefined;
    conditionCount: number;
}

export interface SegmentQueryDomainService {
    getSegment(id: string, tenantFilter?: TenantFilterOptions): Promise<Segment | null>;

    listSegments(filter?: SegmentFilter): Promise<Segment[]>;

    compareSegments(segmentIds: string[]): Promise<SegmentCompareResult[]>;
}

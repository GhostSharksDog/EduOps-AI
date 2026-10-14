import {Segment, SegmentQueryDomainService, SegmentCompareResult} from '@/modules/segment/domain/index';
import {SegmentFilter} from '@/modules/segment/domain/commands/SegmentFilter';
import {SegmentRepository} from '@/modules/segment/domain/ports/SegmentRepository';
import {SortOrder} from '@/shared/enums/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export class SegmentQueryDomainServiceImpl implements SegmentQueryDomainService {
    constructor(
        private readonly segmentRepository: SegmentRepository
    ) {
    }

    async getSegment(id: string, tenantFilter?: TenantFilterOptions): Promise<Segment | null> {
        return this.segmentRepository.findById(id, tenantFilter);
    }

    async listSegments(filter?: SegmentFilter): Promise<Segment[]> {
        const query = {
            name: filter?.name,
            type: filter?.type,
            status: filter?.status,
            pagination: {
                page: filter?.pagination?.page || 1,
                pageSize: filter?.pagination?.pageSize || 100,
                sortOrder: filter?.pagination?.sortOrder || SortOrder.ASC,
            },
            tenantFilter: filter?.tenantFilter,
        };

        const result = await this.segmentRepository.findAll(query);
        return result.items;
    }

    async compareSegments(segmentIds: string[]): Promise<SegmentCompareResult[]> {
        const segments: Segment[] = [];
        for (const id of segmentIds) {
            const segment = await this.segmentRepository.findById(id);
            if (segment) {
                segments.push(segment);
            }
        }

        return segments.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            conditionCount: s.conditionGroup?.conditions?.length || 0
        }));
    }
}

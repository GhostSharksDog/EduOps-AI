import type { SegmentFilterDTO } from '../contracts/schemas/request/segment';
import type { SegmentVO, SegmentListVO } from '../contracts/schemas/response/segment';
export interface SegmentQueryApplicationService {
    getSegment(dto: SegmentFilterDTO): Promise<SegmentVO>;
    listSegments(dto: SegmentFilterDTO): Promise<SegmentListVO>;
    checkNameExists(name: string, tenantFilter?: SegmentFilterDTO['tenantFilter']): Promise<boolean>;
}

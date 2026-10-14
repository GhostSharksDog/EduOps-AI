import type { CreateSegmentDTO, SegmentChangeStatusDTO, SegmentDeleteDTO, UpdateSegmentDTO } from '../contracts/schemas/request/segment';
import type { SegmentVO } from '../contracts/schemas/response/segment';
export interface SegmentManagementApplicationService {
    createSegment(dto: CreateSegmentDTO): Promise<SegmentVO>;
    updateSegment(dto: UpdateSegmentDTO): Promise<SegmentVO>;
    deleteSegment(dto: SegmentDeleteDTO): Promise<void>;
    changeStatus(dto: SegmentChangeStatusDTO): Promise<void>;
}

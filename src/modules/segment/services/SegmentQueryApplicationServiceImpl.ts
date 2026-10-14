import {SegmentQueryApplicationService} from '@/modules/segment/services/SegmentQueryApplicationService';
import {SegmentRepository} from '@/modules/segment/domain/ports/SegmentRepository';
import {SegmentOHSAdapter} from '@/modules/segment/services/SegmentOHSAdapter';
import {SegmentFilterDTO} from '@/modules/segment/contracts/schemas/request/segment/index';
import type {SegmentVO, SegmentListVO} from '@/modules/segment/contracts/schemas/response/segment/index';
import {SortOrder} from '@/shared/enums/common/SortOrder';

export class SegmentQueryApplicationServiceImpl implements SegmentQueryApplicationService {
    constructor(
        private segmentRepository: SegmentRepository,
        private ohsAdapter: SegmentOHSAdapter
    ) {
    }

    async getSegment(dto: SegmentFilterDTO): Promise<SegmentVO> {
        if (dto.id) {
            const segment = await this.segmentRepository.findById(dto.id, dto.tenantFilter);
            if (!segment) throw new Error('人群不存在');
            return this.ohsAdapter.fromSegmentToSegmentVO(segment);
        }
        if (dto.name) {
            const segment = await this.segmentRepository.findByName(dto.name, dto.tenantFilter);
            if (!segment) throw new Error('人群不存在');
            return this.ohsAdapter.fromSegmentToSegmentVO(segment);
        }
        throw new Error('必须提供 ID 或名称');
    }

    async listSegments(dto: SegmentFilterDTO): Promise<SegmentListVO> {
        const page = await this.segmentRepository.findAll({
            ...(dto.ownedBy?{ownedBy:dto.ownedBy}:{}),
            name: dto.name,
            type: dto.type,
            status: dto.status,
            pagination: dto.page && dto.pageSize ? {
                page: dto.page,
                pageSize: dto.pageSize,
                sortOrder: SortOrder.ASC
            } : undefined,
            tenantFilter: dto.tenantFilter
        });

        const items = page.items.map(s => this.ohsAdapter.fromSegmentToSegmentVO(s));
        const totalCount = page.total;
        const currentPage = page.page;
        const currentPageSize = page.pageSize;
        const totalPages = Math.ceil(totalCount / currentPageSize);

        return {
            items,
            totalCount,
            page: currentPage,
            pageSize: currentPageSize,
            totalPages
        };
    }

    async checkNameExists(name: string, tenantFilter?: SegmentFilterDTO['tenantFilter']): Promise<boolean> {
        const segment = await this.segmentRepository.findByName(name, tenantFilter);
        return !!segment;
    }
}

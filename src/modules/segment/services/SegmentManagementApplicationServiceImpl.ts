import {SegmentManagementApplicationService} from '@/modules/segment/services/SegmentManagementApplicationService';
import {SegmentRepository} from '@/modules/segment/domain/ports/SegmentRepository';
import {SegmentDomainService} from '@/modules/segment/domain/services/ports/SegmentDomainService';
import {SegmentOHSAdapter} from '@/modules/segment/services/SegmentOHSAdapter';
import {CreateSegmentDTO, SegmentChangeStatusDTO, SegmentDeleteDTO, SegmentRefreshDTO, UpdateSegmentDTO} from '@/modules/segment/contracts/schemas/request/segment/index';
import {type SegmentVO} from '@/modules/segment/contracts/schemas/response/segment/index';
import {SegmentCreateCommand} from '@/modules/segment/contracts/commands/index';
import {SegmentUpdateCommand} from '@/modules/segment/contracts/commands/index';
import {SegmentStatus} from '@/shared/enums/index';

export class SegmentManagementApplicationServiceImpl implements SegmentManagementApplicationService {
    constructor(
        private segmentRepository: SegmentRepository,
        private segmentDomainService: SegmentDomainService,
        private ohsAdapter: SegmentOHSAdapter
    ) {
    }

    async createSegment(dto: CreateSegmentDTO): Promise<SegmentVO> {
        const command: SegmentCreateCommand = {
            name: dto.name,
            type: dto.entityType,
            calculationType: dto.calculationType,
            conditionGroup: {},
            description: dto.description,
            createdBy: dto.ownedBy
        };

        const segment = await this.segmentDomainService.createSegment(command);
        return this.ohsAdapter.fromSegmentToSegmentVO(segment);
    }

    async updateSegment(dto: UpdateSegmentDTO): Promise<SegmentVO> {
        const command: SegmentUpdateCommand = {
            id: dto.id,
            name: dto.name,
            description: dto.description,
            updatedBy: dto.updatedBy || dto.ownedBy
        };

        const segment = await this.segmentDomainService.updateSegment(command);
        return this.ohsAdapter.fromSegmentToSegmentVO(segment);
    }

    async deleteSegment(dto: SegmentDeleteDTO): Promise<void> {
        const command = {
            id: dto.id,
            deletedBy: dto.deletedBy
        };

        await this.segmentDomainService.deleteSegment(command);
    }

    async changeStatus(dto: SegmentChangeStatusDTO): Promise<void> {
        if (dto.status === SegmentStatus.ACTIVE) {
            await this.segmentDomainService.activateSegment(dto.id);
        } else {
            await this.segmentDomainService.deactivateSegment(dto.id);
        }
    }

}

import {Segment} from '@/modules/segment/domain/entities/index';
import {SegmentCreateCommand} from '@/modules/segment/contracts/commands/index';
import {SegmentUpdateCommand} from '@/modules/segment/contracts/commands/index';
import {SegmentDeleteCommand} from '@/modules/segment/domain/commands/SegmentDeleteCommand';

export interface SegmentDomainService {
    createSegment(command: SegmentCreateCommand): Promise<Segment>;

    updateSegment(command: SegmentUpdateCommand): Promise<Segment>;

    deleteSegment(command: SegmentDeleteCommand): Promise<void>;

    activateSegment(id: string): Promise<Segment>;

    deactivateSegment(id: string): Promise<Segment>;
}

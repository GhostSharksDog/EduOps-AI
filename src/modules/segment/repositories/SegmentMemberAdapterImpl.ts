import {SegmentMemberAdapter} from '@/modules/segment/repositories/SegmentMemberAdapter';
import {SegmentMember} from '@/modules/segment/domain/entities/SegmentMember';
import {SegmentMemberPO} from '@/modules/segment/repositories/persistence/SegmentMemberPO';
import {JoinMethod} from '@/shared/enums/index';
import {Feature} from '@/shared/types/feature';
import {config} from '@/platform/config/index';

export class SegmentMemberAdapterImpl implements SegmentMemberAdapter {
    fromPOToSegmentMemberDomain(po: SegmentMemberPO): SegmentMember {
        const feature = (po.feature as Feature) || {};

        // Derive isActive from isDeleted
        const isActive = !(po.isDeleted ?? false);

        return new SegmentMember(
            po.id,
            po.segmentId,
            po.memberId,
            (po.joinMethod as JoinMethod) || JoinMethod.MANUAL,
            po.joinTime || new Date(),
            po.ownedBy,
            po.createTime || new Date(),
            po.createdBy ?? '',
            undefined, // description
            po.isDeleted ?? false,
            feature,
            po.updateTime || undefined,
            po.deleteTime || undefined,
            po.updatedBy || undefined,
            po.deletedBy || undefined,
            undefined, // leaveTime - only set when member is not active
            isActive
        );
    }

    fromSegmentMemberDomainToPO(entity: SegmentMember): SegmentMemberPO {
        return {
            id: entity.id,
            segmentId: entity.segmentId,
            memberId: entity.memberId,
            joinTime: entity.joinedAt,
            joinMethod: entity.joinMethod.toString(),
            feature: {},
            name: null,
            ownedBy: entity.ownedBy,
            description: null,
            isDeleted: false,
            createTime: new Date(),
            updateTime: new Date(),
            deleteTime: null,
            createdBy: entity.createdBy ?? entity.ownedBy ?? config.system.userId,
            updatedBy: null,
            deletedBy: null
        };
    }
}

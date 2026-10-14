import {SegmentFactory} from '@/modules/segment/domain/factories/index';
import {Segment} from '@/modules/segment/domain/entities/index';
import {JoinMethod, SegmentStatus, SegmentType, SegmentCalculationType} from '@/shared/enums/index';
import {SegmentCondition, SegmentConditionGroup} from '@/modules/segment/domain/value-objects/index';
import {SegmentMember} from '@/modules/segment/domain/entities/SegmentMember';
import {v4 as uuidv4} from 'uuid';
import {
    SegmentCreateCommand,
    CreateSegmentConditionCommand,
    CreateSegmentConditionGroupCommand,
    AddSegmentMemberCommand
} from '@/modules/segment/contracts/commands/index';
import { config } from '@/platform/config/index';
import type {SegmentConditionGroupDTO} from '@/modules/segment/contracts/schemas/request/segment/index';

export class SegmentFactoryImpl implements SegmentFactory {
    createSegment(command: SegmentCreateCommand): Segment {
        const now = new Date();

        return new Segment(
            uuidv4(),
            command.name,
            command.ownedBy ?? config.system.userId,
            now,
            command.createdBy,
            command.description || undefined,
            false,
            command.feature,
            now,
            undefined,
            undefined,
            undefined,
            command.type as SegmentType,
            SegmentStatus.DRAFT,
            command.calculationType as SegmentCalculationType,
            command.conditionGroup as unknown as SegmentConditionGroup,
            {
                totalMembers: 0,
                lastCalculatedAt: undefined
            },
            {
                createdAt: now,
                createdBy: command.createdBy,
                updatedAt: now,
                updatedBy: command.createdBy,
                businessOwner: command.createdBy,
                technicalOwner: undefined
            },
            command.type,
            undefined,
            undefined,
            0,
            undefined,
            undefined
        );
    }

    createCondition(command: CreateSegmentConditionCommand): SegmentCondition {
        return {
            id: uuidv4(),
            tagId: command.tagId,
            operator: command.operator,
            value: command.value,
            valueType: command.valueType
        };
    }

    createConditionGroup(command: CreateSegmentConditionGroupCommand): SegmentConditionGroup {
        return {
            operator: command.operator,
            conditions: command.conditions
        };
    }

    createSegmentMember(command: AddSegmentMemberCommand): SegmentMember {
        const now = new Date();
        const ownedBy = command.ownedBy ?? config.system.userId;
        return new SegmentMember(
            uuidv4(),
            command.segmentId,
            command.memberId,
            command.joinMethod || JoinMethod.MANUAL,
            now,
            ownedBy,
            now,
            command.createdBy,
            command.description || undefined,
            false,
            undefined,
            now,
            now,
            undefined,
            undefined,
            undefined,
            true
        );
    }
}

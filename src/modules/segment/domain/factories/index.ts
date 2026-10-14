import {
    SegmentCreateCommand,
    CreateSegmentConditionCommand,
    CreateSegmentConditionGroupCommand,
    AddSegmentMemberCommand
} from '@/modules/segment/contracts/commands/index';
import {Segment, SegmentMember} from '@/modules/segment/domain/entities/index';
import {SegmentCondition, SegmentConditionGroup} from '@/modules/segment/domain/value-objects/index';

export interface SegmentFactory {
    /**
     * 创建分群
     * @param command 创建分群命令
     */
    createSegment(command: SegmentCreateCommand): Segment;

    /**
     * 创建分群条件
     * @param command 创建分群条件命令
     */
    createCondition(command: CreateSegmentConditionCommand): SegmentCondition;

    /**
     * 创建分群条件组
     * @param command 创建分群条件组命令
     */
    createConditionGroup(command: CreateSegmentConditionGroupCommand): SegmentConditionGroup;

    /**
     * 创建分群成员
     * @param command 添加分群成员命令
     */
    createSegmentMember(command: AddSegmentMemberCommand): SegmentMember;
}

export * from '@/modules/segment/domain/factories/SegmentFactoryImpl';

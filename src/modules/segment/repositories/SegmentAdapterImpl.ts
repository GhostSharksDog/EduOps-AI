import {Segment as DomainSegment} from '@/modules/segment/domain/entities/Segment';
import {SegmentMember as DomainSegmentMember} from '@/modules/segment/domain/entities/SegmentMember';
import {SegmentCalculationTask as DomainSegmentCalculationTask} from '@/modules/segment/domain/entities/SegmentCalculationTask';
import {SegmentPO} from '@/modules/segment/repositories/persistence/SegmentPO';
import {SegmentMemberPO} from '@/modules/segment/repositories/persistence/SegmentMemberPO';
import {SegmentConditionPO} from '@/modules/segment/repositories/persistence/SegmentConditionPO';
import {SegmentCalculationTaskPO} from '@/modules/segment/repositories/persistence/SegmentCalculationTaskPO';
import {SegmentConditionGroup} from '@/modules/segment/domain/value-objects/SegmentConditionGroup';
import {SegmentCondition as DomainSegmentCondition} from '@/modules/segment/domain/value-objects/SegmentCondition';
import {Feature} from "@/shared/types/feature";
import {
    ComparisonOperator,
    ConditionOperator,
    JoinMethod,
    SegmentCalculationPeriod,
    SegmentCalculationStatus,
    SegmentCalculationType,
    SegmentStatus,
    SegmentType
} from '@/shared/enums/index';
import {SegmentAdapter} from '@/modules/segment/repositories/SegmentAdapter';
import {isJsonObject} from '@/shared/utils/typeGuards';

/**
 * Segment适配器实现
 * 负责领域实体与PO之间的转换
 * 使用显式PostgreSQL行类型
 */
export class SegmentAdapterImpl implements SegmentAdapter {
    /**
     * 将PO转换为领域实体
     */
    fromPOToSegment(
        row: SegmentPO,
        conditions: SegmentConditionPO[] = []
    ): DomainSegment {
        const conditionGroup = this.buildConditionTree(conditions);

        const feature = isJsonObject(row.feature) ? row.feature : {};

        // 构建元数据 - 处理数据库可空列
        const metadata = {
            createdAt: row.createTime ,
            createdBy: row.createdBy || '',
            updatedAt: row.updateTime || row.createTime || new Date(),
            updatedBy: row.updatedBy || '',
            deletedAt: row.deleteTime || undefined,
            deletedBy: row.deletedBy || undefined,
            description: row.description || undefined,
            tags: (feature.tags as string[]) || [],
            businessOwner: row.ownedBy ?? '',
            technicalOwner: (feature.technicalOwner as string) || undefined,
        };

        // 构建统计信息
        const frozenMemberCount=feature.engine==='education-attendance-v1'&&typeof feature.memberCount==='number'?feature.memberCount:0;
        const statistics = {
            totalMembers: frozenMemberCount,
            lastCalculatedAt: row.lastCalculationTime || undefined,
        };

        // 解析计算周期
        const calculationPeriod = this.parseCalculationPeriod(row);

        return new DomainSegment(
            row.id,
            row.name || 'Unnamed Segment',
            row.ownedBy,
            row.createTime || new Date(),
            row.createdBy || '',
            row.description || undefined,
            row.isDeleted || false,
            row.feature as Feature | undefined,
            row.updateTime || row.createTime || new Date(),
            row.deleteTime || undefined,
            row.updatedBy || undefined,
            row.deletedBy || undefined,
            row.entityType as SegmentType | undefined,
            row.status as SegmentStatus | undefined,
            row.computeType as SegmentCalculationType | undefined,
            conditionGroup,
            statistics,
            metadata,
            row.entityType as SegmentType | undefined,
            row.scheduleConfig as Feature | undefined,
            calculationPeriod,
            frozenMemberCount,
            row.lastCalculationTime || undefined,
            undefined
        );
    }

    /**
     * 将领域实体转换为PO
     */
    fromSegmentToPO(domainSegment: DomainSegment): SegmentPO {
        return {
            id: domainSegment.id,
            name: domainSegment.name,
            description: domainSegment.description || null,
            entityType: domainSegment.type as string,
            computeType: domainSegment.calculationType as string,
            ownedBy: domainSegment.ownedBy,
            status: domainSegment.status as string,
            scheduleConfig: domainSegment.scheduleConfig || null,
            lastCalculationTime: domainSegment.lastCalculationTime || null,
            feature: domainSegment.feature || null,
            isDeleted: domainSegment.isDeleted,
            createTime: domainSegment.createTime || null,
            updateTime: domainSegment.updateTime || null,
            deleteTime: domainSegment.deleteTime || null,
            createdBy: domainSegment.createdBy ?? '',
            updatedBy: domainSegment.updatedBy || null,
            deletedBy: domainSegment.deletedBy || null,
        };
    }

    /**
     * 将成员PO转换为领域实体
     * 存储列由仓储映射为camelCase
     * 注意：数据库行没有leaveTime和isActive字段，这些值通过业务逻辑派生
     */
    fromMemberPOToSegmentMember(po: SegmentMemberPO): DomainSegmentMember {
        const isActive = !(po.isDeleted ?? false);
        const leaveTime = isActive ? undefined : new Date();

        return new DomainSegmentMember(
            po.id,
            po.segmentId,
            po.memberId,
            (po.joinMethod as JoinMethod) || JoinMethod.MANUAL,
            po.joinTime || new Date(),
            po.ownedBy,
            po.createTime || new Date(),
            po.createdBy || '',
            po.description || undefined,
            po.isDeleted ?? false,
            po.feature || undefined,
            po.updateTime || undefined,
            po.deleteTime || undefined,
            po.updatedBy || undefined,
            po.deletedBy || undefined,
            leaveTime,
            isActive
        );
    }

    /**
     * 将领域实体转换为成员PO
     * 注意：数据库行没有leaveTime和isActive字段，这些值不持久化
     * 注意：数据库行有name字段，需要包含
     */
    fromSegmentMemberToMemberPO(domainMember: DomainSegmentMember): SegmentMemberPO {
        return {
            id: domainMember.id,
            name: null,
            segmentId: domainMember.segmentId,
            memberId: domainMember.memberId,
            joinMethod: domainMember.joinMethod,
            joinTime: domainMember.joinedAt,
            description: domainMember.description || null,
            ownedBy: domainMember.ownedBy,
            isDeleted: domainMember.isDeleted,
            feature: domainMember.feature || null,
            createTime: domainMember.createTime || new Date(),
            updateTime: domainMember.updateTime || null,
            deleteTime: domainMember.deleteTime || null,
            createdBy: domainMember.createdBy ?? '',
            updatedBy: domainMember.updatedBy || null,
            deletedBy: domainMember.deletedBy || null,
        };
    }

    /**
     * 将任务PO转换为领域实体
     * startTime和endTime可能是null，需要处理
     */
    fromTaskPOToSegmentCalculationTask(po: SegmentCalculationTaskPO): DomainSegmentCalculationTask {
        const task = new DomainSegmentCalculationTask(
            po.segmentId,
            po.name || 'Task',
            po.ownedBy,
            po.createdBy || '',  // createdBy is 4th parameter
            (po.status as SegmentCalculationStatus) || SegmentCalculationStatus.PENDING,  // status is 5th parameter
            po.description || undefined,
            po.id
        );

        // 处理可能的null值
        task.startTime = po.startTime ? new Date(po.startTime) : new Date();
        task.endTime = po.endTime || undefined;
        task.resultCount = po.resultCount || 0;
        task.errorMessage = po.errorMessage || undefined;
        task.isDeleted = po.isDeleted || false;
        task.feature = po.feature || undefined;
        task.createTime = po.createTime || new Date();
        task.updateTime = po.updateTime || undefined;
        task.deleteTime = po.deleteTime || undefined;
        task.createdBy = po.createdBy ?? '';
        task.updatedBy = po.updatedBy || undefined;
        task.deletedBy = po.deletedBy || undefined;

        return task;
    }

    /**
     * 将领域实体转换为任务PO
     */
    fromSegmentCalculationTaskToTaskPO(domainTask: DomainSegmentCalculationTask): SegmentCalculationTaskPO {
        return {
            id: domainTask.id,
            segmentId: domainTask.segmentId,
            name: domainTask.name || null,
            description: domainTask.description || null,
            ownedBy: domainTask.ownedBy,
            startTime: domainTask.startTime,
            endTime: domainTask.endTime || null,
            status: domainTask.status,
            resultCount: domainTask.resultCount,
            errorMessage: domainTask.errorMessage || null,
            isDeleted: domainTask.isDeleted,
            feature: domainTask.feature || null,
            createTime: domainTask.createTime,
            updateTime: domainTask.updateTime || null,
            deleteTime: domainTask.deleteTime || null,
            createdBy: domainTask.createdBy ?? '',
            updatedBy: domainTask.updatedBy || null,
            deletedBy: domainTask.deletedBy || null
        };
    }

    /**
     * 构建条件树
     */
    private buildConditionTree(conditions: SegmentConditionPO[]): SegmentConditionGroup {
        if (!conditions || conditions.length === 0) {
            return {operator: ConditionOperator.AND, conditions: []};
        }

        // 找到根节点(parentId 为 null)
        const root = conditions.find(c => c.parentId === null);
        if (!root) {
            return {operator: ConditionOperator.AND, conditions: []};
        }

        return this.mapToConditionGroup(root, conditions);
    }

    /**
     * 映射条件组
     */
    private mapToConditionGroup(
        current: SegmentConditionPO,
        allConditions: SegmentConditionPO[]
    ): SegmentConditionGroup {
        const children = allConditions.filter(c => c.parentId === current.id);

        const mappedConditions = children.map(child => {
            if (child.conditionType === 'GROUP') {
                return this.mapToConditionGroup(child, allConditions);
            } else {
                return this.mapToCondition(child);
            }
        });

        return {
            operator: (current.operator as ConditionOperator) || ConditionOperator.AND,
            conditions: mappedConditions,
        };
    }

    /**
     * 映射单个条件
     */
    private mapToCondition(row: SegmentConditionPO): DomainSegmentCondition {
        return {
            id: row.id,
            tagId: row.fieldName || '',
            operator: (row.operator as ComparisonOperator) || ComparisonOperator.EQUAL,
            value: row.fieldValue as string | number | boolean | Date | Array<string | number>,
            valueType: 'string',
        };
    }

    /**
     * 解析计算周期
     */
    private parseCalculationPeriod(po: SegmentPO): SegmentCalculationPeriod | undefined {
        const scheduleConfig = isJsonObject(po.scheduleConfig) ? po.scheduleConfig : {};
        if (!scheduleConfig) return undefined;

        const cron = scheduleConfig.cron as string;
        if (!cron) return undefined;

        if (cron.includes('* * * * *')) return SegmentCalculationPeriod.MONTHLY;
        if (cron.includes('* * * * 0')) return SegmentCalculationPeriod.WEEKLY;
        if (cron.includes('* * * * *')) return SegmentCalculationPeriod.DAILY;

        return SegmentCalculationPeriod.MANUAL;
    }
}

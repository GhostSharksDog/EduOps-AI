import {Segment} from '@/modules/segment/domain/entities/Segment';
import {SegmentMember} from '@/modules/segment/domain/entities/SegmentMember';
import {SegmentCalculationTask} from '@/modules/segment/domain/entities/SegmentCalculationTask';
import {SegmentPO} from '@/modules/segment/repositories/persistence/SegmentPO';
import {SegmentMemberPO} from '@/modules/segment/repositories/persistence/SegmentMemberPO';
import {SegmentConditionPO} from '@/modules/segment/repositories/persistence/SegmentConditionPO';
import {SegmentCalculationTaskPO} from '@/modules/segment/repositories/persistence/SegmentCalculationTaskPO';

/**
 * 分群适配器接口
 * 负责领域实体与PO之间的转换
 */
export interface SegmentAdapter {
    /**
     * 将分群PO转换为领域实体
     * @param segmentPO 分群持久化对象
     * @param conditionPOs 分群条件持久化对象数组
     * @returns 分群领域实体
     */
    fromPOToSegment(segmentPO: SegmentPO, conditionPOs?: SegmentConditionPO[]): Segment;

    /**
     * 将分群领域实体转换为PO
     * @param segment 分群领域实体
     * @returns 分群持久化对象
     */
    fromSegmentToPO(segment: Segment): SegmentPO;

    /**
     * 将成员PO转换为领域实体
     * @param po 成员持久化对象
     * @returns 成员领域实体
     */
    fromMemberPOToSegmentMember(po: SegmentMemberPO): SegmentMember;

    /**
     * 将成员领域实体转换为PO
     * @param domainMember 成员领域实体
     * @returns 成员持久化对象
     */
    fromSegmentMemberToMemberPO(domainMember: SegmentMember): SegmentMemberPO;

    /**
     * 将任务PO转换为领域实体
     * @param po 任务持久化对象
     * @returns 任务领域实体
     */
    fromTaskPOToSegmentCalculationTask(po: SegmentCalculationTaskPO): SegmentCalculationTask;

    /**
     * 将任务领域实体转换为PO
     * @param domainTask 任务领域实体
     * @returns 任务持久化对象
     */
    fromSegmentCalculationTaskToTaskPO(domainTask: SegmentCalculationTask): SegmentCalculationTaskPO;
}

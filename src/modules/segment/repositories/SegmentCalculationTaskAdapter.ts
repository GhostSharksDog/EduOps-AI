import {SegmentCalculationTask} from '@/modules/segment/domain/entities/SegmentCalculationTask';
import {SegmentCalculationTaskPO} from '@/modules/segment/repositories/persistence/SegmentCalculationTaskPO';

/**
 * 分群计算任务适配器接口
 */
export interface SegmentCalculationTaskAdapter {
    /**
     * 将分群计算任务持久化对象转换为领域实体
     * @param taskPO 分群计算任务持久化对象
     * @returns 分群计算任务领域实体
     */
    fromPOToSegmentCalculationTask(taskPO: SegmentCalculationTaskPO): SegmentCalculationTask;

    /**
     * 将分群计算任务领域实体转换为持久化对象
     * @param task 分群计算任务领域实体
     * @returns 分群计算任务持久化对象
     */
    fromSegmentCalculationTaskToPO(task: SegmentCalculationTask): Partial<SegmentCalculationTaskPO>;
}

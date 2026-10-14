import {SegmentCalculationTask, TaskId} from '@/modules/segment/domain/entities/SegmentCalculationTask';

/**
 * 分页查询参数
 */
export interface TaskQuery {
    /**
     * 当前页码
     */
    page: number;
    /**
     * 每页数量
     */
    pageSize: number;
    /**
     * 任务状态
     */
    status?: string;
    /**
     * 开始时间之后
     */
    startTimeAfter?: Date;
    /**
     * 开始时间之前
     */
    startTimeBefore?: Date;
}

/**
 * 分页结果
 */
export interface Page<T> {
    /**
     * 总数量
     */
    total: number;
    /**
     * 分页数据
     */
    items: T[];
    /**
     * 当前页码
     */
    page: number;
    /**
     * 每页数量
     */
    pageSize: number;
}

/**
 * 分群计算任务仓库接口
 */
export interface SegmentCalculationTaskRepository {
    /**
     * 保存计算任务
     * @param task 计算任务实体
     */
    save(task: SegmentCalculationTask): Promise<void>;

    /**
     * 根据ID获取计算任务
     * @param taskId 任务ID
     * @returns 计算任务实体，找不到则返回null
     */
    findById(taskId: TaskId): Promise<SegmentCalculationTask | null>;

    /**
     * 根据分群ID获取计算任务列表
     * @param segmentId 分群ID
     * @param query 查询参数
     * @returns 分页后的计算任务列表
     */
    findBySegmentId(segmentId: string, query: TaskQuery): Promise<Page<SegmentCalculationTask>>;

    /**
     * 获取分群最新的计算任务
     * @param segmentId 分群ID
     * @returns 最新的计算任务实体，找不到则返回null
     */
    findLatestBySegmentId(segmentId: string): Promise<SegmentCalculationTask | null>;

    /**
     * 获取所有待处理的任务
     * @returns 待处理的任务列表
     */
    findPendingTasks(): Promise<SegmentCalculationTask[]>;
}

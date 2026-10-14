import {SegmentCalculationStatus} from '@/shared/enums/index';
import {v4 as uuidv4} from 'uuid';
import {Feature} from "@/shared/types/feature";

/**
 * 任务ID类型
 */
export type TaskId = string;

/**
 * 分群计算任务实体
 * 根据SQL表结构 public.segment_calculation_task 设计
 */
export class SegmentCalculationTask {
    id: TaskId;
    segmentId: string;
    name: string;
    description?: string;
    ownedBy: string;
    isDeleted: boolean;
    feature?: Feature;
    createTime: Date;
    updateTime?: Date;
    deleteTime?: Date;
    createdBy: string;
    updatedBy?: string;
    deletedBy?: string;
    status: SegmentCalculationStatus;
    startTime: Date;
    endTime?: Date;
    resultCount: number;
    errorMessage?: string;

    constructor(
        segmentId: string,
        name: string,
        ownedBy: string,
        createdBy: string,
        status: SegmentCalculationStatus = SegmentCalculationStatus.PENDING,
        description?: string,
        id?: TaskId
    ) {
        this.id = id || uuidv4();
        this.segmentId = segmentId;
        this.name = name;
        this.ownedBy = ownedBy;
        this.createdBy = createdBy;
        this.status = status;
        this.startTime = new Date();
        this.resultCount = 0;
        this.isDeleted = false;
        this.description = description;
        this.createTime = new Date();
    }

    /**
     * 开始任务
     */
    start(): void {
        this.status = SegmentCalculationStatus.RUNNING;
        this.startTime = new Date();
        this.updateTime = new Date();
    }

    /**
     * 完成任务
     */
    complete(resultCount: number): void {
        this.status = SegmentCalculationStatus.COMPLETED;
        this.endTime = new Date();
        this.resultCount = resultCount;
        this.updateTime = new Date();
    }

    /**
     * 标记任务失败
     */
    fail(errorMessage: string): void {
        this.status = SegmentCalculationStatus.FAILED;
        this.endTime = new Date();
        this.errorMessage = errorMessage;
        this.updateTime = new Date();
    }

    /**
     * 软删除任务
     */
    softDelete(deletedBy: string): void {
        this.isDeleted = true;
        this.deleteTime = new Date();
        this.deletedBy = deletedBy;
        this.updateTime = new Date();
    }

    /**
     * 设置扩展特性
     */
    setFeature(feature: Feature): void {
        this.feature = feature;
        this.updateTime = new Date();
    }

    /**
     * 获取执行时长（毫秒）
     */
    getExecutionTime(): number {
        const end = this.endTime || new Date();
        return end.getTime() - this.startTime.getTime();
    }

    /**
     * 检查任务是否完成
     */
    isCompleted(): boolean {
        return this.status === SegmentCalculationStatus.COMPLETED ||
            this.status === SegmentCalculationStatus.FAILED;
    }
}

import {SegmentCalculationPeriod, SegmentCalculationType, SegmentStatus, SegmentType} from '@/shared/enums/index';
import {SegmentConditionGroup, SegmentMetadata, SegmentStatistics} from '@/modules/segment/domain/value-objects/index';
import {Feature} from "@/shared/types/feature";

/**
 * 分群实体类(充血模型)
 * 根据SQL表结构 public.segment 设计
 */
export class Segment {
    constructor(
        public id: string,
        public name: string,
        public ownedBy: string,
        public createTime: Date,
        public createdBy: string,
        public description?: string,
        public isDeleted: boolean = false,
        public feature?: Feature,
        public updateTime?: Date,
        public deleteTime?: Date,
        public updatedBy?: string,
        public deletedBy?: string,
        public type?: SegmentType,
        public status?: SegmentStatus,
        public calculationType?: SegmentCalculationType,
        public conditionGroup?: SegmentConditionGroup,
        public statistics?: SegmentStatistics,
        public metadata?: SegmentMetadata,
        public entityType?: SegmentType,
        public scheduleConfig?: Feature,
        public calculationPeriod?: SegmentCalculationPeriod,
        public memberCount: number = 0,
        public lastCalculationTime?: Date,
        public nextCalculationTime?: Date
    ) {
    }

    /**
     * 更改分群状态
     */
    public changeStatus(status: SegmentStatus): void {
        this.status = status;
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }

    /**
     * 更新分群条件
     */
    public updateConditions(conditionGroup: SegmentConditionGroup): void {
        this.conditionGroup = conditionGroup;
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }

    /**
     * 更新统计信息
     */
    public updateStatistics(statistics: Partial<SegmentStatistics>): void {
        this.statistics = {
            totalMembers: this.statistics?.totalMembers ?? 0,
            ...this.statistics,
            ...statistics,
        };
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }

    /**
     * 更新成员数量
     */
    public updateMemberCount(count: number): void {
        this.memberCount = count;
        if (this.statistics) {
            this.statistics.totalMembers = count;
        }
        this.lastCalculationTime = new Date();
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }

    /**
     * 更新计算时间
     */
    public updateCalculationTime(lastTime: Date, nextTime?: Date): void {
        this.lastCalculationTime = lastTime;
        this.nextCalculationTime = nextTime;
        if (this.statistics) {
            this.statistics.lastCalculatedAt = lastTime;
        }
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }

    /**
     * 设置扩展特性
     */
    public setFeature(feature: Feature): void {
        this.feature = feature;
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }

    /**
     * 设置调度配置
     */
    public setScheduleConfig(config: Feature): void {
        this.scheduleConfig = config;
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }

    /**
     * 激活分群
     */
    public activate(updatedBy: string): void {
        if (this.status !== SegmentStatus.DRAFT) {
            throw new Error('只有草稿状态的分群可以激活');
        }
        this.status = SegmentStatus.ACTIVE;
        this.updateTime = new Date();
        this.updatedBy = updatedBy;
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
            this.metadata.updatedBy = updatedBy;
        }
    }

    /**
     * 停用分群
     */
    public deactivate(updatedBy: string): void {
        if (this.status !== SegmentStatus.ACTIVE) {
            throw new Error('只有激活状态的分群可以停用');
        }
        this.status = SegmentStatus.INACTIVE;
        this.updateTime = new Date();
        this.updatedBy = updatedBy;
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
            this.metadata.updatedBy = updatedBy;
        }
    }

    /**
     * 标记为计算中
     */
    public markAsCalculating(): void {
        this.status = SegmentStatus.CALCULATING;
        this.updateTime = new Date();
        if (this.metadata) {
            this.metadata.updatedAt = new Date();
        }
    }
}

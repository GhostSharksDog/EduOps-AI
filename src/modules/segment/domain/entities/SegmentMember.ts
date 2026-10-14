import {JoinMethod} from '@/shared/enums/index';
import {Feature} from "@/shared/types/feature";

/**
 * 分群成员实体
 * 根据SQL表结构 public.segment_member 设计
 */
export class SegmentMember {
    constructor(
        public id: string,
        public segmentId: string,
        public memberId: string,
        public joinMethod: JoinMethod,
        public joinedAt: Date,
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
        public leaveTime?: Date,
        public isActive: boolean = true
    ) {
    }

    /**
     * 标记为离开
     */
    public markAsLeft(): void {
        this.leaveTime = new Date();
        this.isActive = false;
        this.updateTime = new Date();
    }

    /**
     * 软删除成员
     */
    public softDelete(deletedBy: string): void {
        this.isDeleted = true;
        this.deleteTime = new Date();
        this.deletedBy = deletedBy;
        this.updateTime = new Date();
    }

    /**
     * 恢复成员
     */
    public restore(): void {
        this.isDeleted = false;
        this.deleteTime = undefined;
        this.deletedBy = undefined;
        this.isActive = true;
        this.leaveTime = undefined;
        this.updateTime = new Date();
    }

    /**
     * 设置扩展特性
     */
    public setFeature(feature: Feature): void {
        this.feature = feature;
        this.updateTime = new Date();
    }

    /**
     * 检查是否有效成员
     */
    public isValidMember(): boolean {
        return this.isActive && !this.isDeleted;
    }
}

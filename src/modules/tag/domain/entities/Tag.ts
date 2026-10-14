import {TagVersion} from '@/modules/tag/domain/entities/TagVersion';
import {TagCategory} from '@/modules/tag/domain/index';
import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import {Feature} from "@/shared/types/feature";

export interface BitConfig {
    bitmapTableId: string;
    bitPosition: number;
}

/**
 * 标签实体类(充血模型)
 *
 * 架构交互:
 * 1. 核心实体(Tag) 的聚合根类
 * 2. 下游支撑: 为 Segment (分群) 模块提供计算基础数据
 * 3. 分群计算时，通过 TagId 引用具体的标签定义
 * 4. 约束: 每个标签必须归属于一个标签类目 (categoryId 必填)
 *
 * 与 Schema 对应: src/shared/schemas/response/tag.ts::tagSchema
 */
export class Tag {
    public tagValues: unknown[] = [];

    constructor(
        public id: string,
        public name: string,
        public dataType: TagValueType,
        public status: TagStatus,
        public updateCycle: UpdateCycle,
        public ownedBy: string,
        public categoryId: string,
        public createTime: Date,
        public createdBy: string,
        public isPublic: boolean = false,
        public description?: string,
        public category?: TagCategory,
        public feature?: Feature,
        public bitConfig?: BitConfig,
        public currentVersionId?: string,
        public currentVersion?: TagVersion,
        public versions: TagVersion[] = [],
        public isDeleted: boolean = false,
        public updateTime?: Date,
        public deleteTime?: Date,
        public updatedBy?: string,
        public deletedBy?: string,
        public targetTableId?: string
    ) {
    }

    private static readonly VALID_TRANSITIONS: Record<string, TagStatus[]> = {
        [TagStatus.DRAFT]: [TagStatus.ACTIVE],
        [TagStatus.ACTIVE]: [TagStatus.INACTIVE],
        [TagStatus.INACTIVE]: [TagStatus.ACTIVE, TagStatus.DEPRECATED],
        [TagStatus.DEPRECATED]: [TagStatus.INACTIVE],
    };

    public changeStatus(newStatus: TagStatus): void {
        const allowed = Tag.VALID_TRANSITIONS[this.status];
        if (!allowed || !allowed.includes(newStatus)) {
            throw new Error(`Invalid status transition: ${this.status} → ${newStatus}`);
        }
        this.status = newStatus;
        this.updateTime = new Date();
    }

    public updateInfo(name: string, description?: string, updateCycle?: UpdateCycle): void {
        this.name = name;
        if (description !== undefined) {
            this.description = description;
        }
        if (updateCycle !== undefined) {
            this.updateCycle = updateCycle;
        }
        this.updateTime = new Date();
    }

    public updateBitConfig(bitConfig?: BitConfig): void {
        this.bitConfig = bitConfig;
        this.updateTime = new Date();
    }

    public setPublic(isPublic: boolean): void {
        this.isPublic = isPublic;
        this.updateTime = new Date();
    }

    public publish(): void {
        if (this.status !== TagStatus.ACTIVE) {
            this.changeStatus(TagStatus.ACTIVE);
        }
    }

    public offline(): void {
        if (this.status !== TagStatus.INACTIVE) {
            this.changeStatus(TagStatus.INACTIVE);
        }
    }

    public addVersion(version: TagVersion): void {
        this.versions.push(version);
        this.updateTime = new Date();
    }

    public setCurrentVersion(versionId: string): void {
        this.currentVersionId = versionId;
        const version = this.versions.find(v => v.id === versionId);
        if (version) {
            // 取消当前版本标记
            this.versions.forEach(v => v.unsetAsCurrent());
            // 设置新版本为当前版本
            version.setAsCurrent();
            this.currentVersion = version;
        }
        this.updateTime = new Date();
    }

    /**
     * 从回收站恢复标签
     * - 将 isDeleted 设为 false
     * - 清除删除相关字段
     * - 状态设为 INACTIVE
     * 注意: bitConfig 由外部服务清空，不在此方法处理
     */
    public restore(): void {
        this.isDeleted = false;
        this.deleteTime = undefined;
        this.deletedBy = undefined;
        this.status = TagStatus.INACTIVE;
        this.updateTime = new Date();
    }

    /**
     * 将标签标记为废弃
     * - 用于标记不再使用但需要保留历史数据的标签
     * - 废弃状态可以跳过停用直接删除
     * @param reason 废弃原因（可选）
     */
    public deprecate(reason?: string): void {
        if (this.status !== TagStatus.DEPRECATED) {
            this.status = TagStatus.DEPRECATED;
            this.updateTime = new Date();
            // reason 可用于审计日志，暂不存储在实体中
        }
    }
}

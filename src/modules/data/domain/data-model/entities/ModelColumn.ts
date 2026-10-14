import {DataType} from '@/shared/enums/index';
import {Feature} from "@/shared/types/feature";

/**
 * 模型列实体
 */
export class ModelColumn {
    constructor(
        public readonly id: string,
        public readonly modelId: string,
        public name: string,
        public readonly ownedBy: string,
        public readonly createTime: Date,
        public readonly createdBy: string,
        public description?: string,
        public feature?: Feature,
        public isDeleted: boolean = false,
        public updateTime?: Date,
        public deleteTime?: Date | null,
        public updatedBy?: string | null,
        public deletedBy?: string | null,
        public displayName?: string,
        public dataType?: DataType,
        public length?: number | null,
        public precision?: number | null,
        public scale?: number | null,
        public isNullable?: boolean,
        public defaultValue?: unknown | null,
        public orderIndex?: number,
        public isPrimaryKey?: boolean
    ) {
    }

    /**
     * 设置为主键
     */
    public setAsPrimaryKey(): void {
        this.isPrimaryKey = true;
        this.updateTime = new Date();
    }

    /**
     * 取消主键设置
     */
    public unsetAsPrimaryKey(): void {
        this.isPrimaryKey = false;
        this.updateTime = new Date();
    }

    /**
     * 更新显示顺序
     * @param orderIndex 显示顺序
     */
    public updateOrder(orderIndex: number): void {
        this.orderIndex = orderIndex;
        this.updateTime = new Date();
    }

    /**
     * 更新列信息
     * @param updates 更新内容
     */
    public update(updates: {
        name?: string;
        displayName?: string;
        dataType?: DataType;
        length?: number | null;
        precision?: number | null;
        scale?: number | null;
        isNullable?: boolean;
        defaultValue?: unknown | null;
        description?: string;
        orderIndex?: number;
        isPrimaryKey?: boolean;
    }): void {
        if (updates.name !== undefined) this.name = updates.name;
        if (updates.displayName !== undefined) this.displayName = updates.displayName;
        if (updates.dataType !== undefined) this.dataType = updates.dataType;
        if (updates.length !== undefined) this.length = updates.length;
        if (updates.precision !== undefined) this.precision = updates.precision;
        if (updates.scale !== undefined) this.scale = updates.scale;
        if (updates.isNullable !== undefined) this.isNullable = updates.isNullable;
        if (updates.defaultValue !== undefined) this.defaultValue = updates.defaultValue;
        if (updates.description !== undefined) this.description = updates.description;
        if (updates.orderIndex !== undefined) this.orderIndex = updates.orderIndex;
        if (updates.isPrimaryKey !== undefined) this.isPrimaryKey = updates.isPrimaryKey;

        this.updateTime = new Date();
    }
}

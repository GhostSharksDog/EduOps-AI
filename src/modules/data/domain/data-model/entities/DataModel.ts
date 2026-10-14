import {DataModelStatus} from '@/shared/enums/index';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {Feature} from "@/shared/types/feature";

/**
 * 数据模型实体
 * 对应 Schema: src/shared/schemas/response/data-model.ts::dataModelSchema
 */
export class DataModel {
    constructor(
        public readonly id: string,
        public name: string,
        public status: DataModelStatus,
        public datasource: DataSource,
        public readonly ownedBy: string,
        public readonly createTime: Date,
        public readonly createdBy: string,
        public description?: string,
        public tableName?: string,
        public columns: ModelColumn[] = [],
        public feature?: Feature,
        public isDeleted: boolean = false,
        public updateTime?: Date,
        public deleteTime?: Date | null,
        public updatedBy?: string | null,
        public deletedBy?: string | null
    ) {
    }

    /**
     * 激活数据模型
     */
    public activate(): void {
        this.status = DataModelStatus.ACTIVE;
        this.updateTime = new Date();
    }

    /**
     * 停用数据模型
     */
    public deactivate(): void {
        this.status = DataModelStatus.INACTIVE;
        this.updateTime = new Date();
    }

    /**
     * 更新基本信息
     * @param name 模型名称
     * @param description 模型描述
     * @param tableName 映射的物理表名
     */
    public updateInfo(name: string, description?: string, tableName?: string): void {
        this.name = name;
        if (description !== undefined) {
            this.description = description;
        }
        if (tableName !== undefined) {
            this.tableName = tableName;
        }
        this.updateTime = new Date();
    }

    /**
     * 添加列
     * @param column 模型列
     */
    public addColumn(column: ModelColumn): void {
        this.columns.push(column);
        this.updateTime = new Date();
    }

    /**
     * 更新列
     * @param column 模型列
     */
    public updateColumn(column: ModelColumn): void {
        const index = this.columns.findIndex(col => col.id === column.id);
        if (index !== -1) {
            this.columns[index] = column;
            this.updateTime = new Date();
        }
    }

    /**
     * 移除列
     * @param columnId 列ID
     */
    public removeColumn(columnId: string): void {
        this.columns = this.columns.filter(col => col.id !== columnId);
        this.updateTime = new Date();
    }

    /**
     * 删除数据模型（软删除）
     * @param deletedBy 删除人ID
     */
    public delete(deletedBy: string): void {
        if (!this.isDeleted) {
            this.isDeleted = true;
            this.deleteTime = new Date();
            this.deletedBy = deletedBy;
            this.updateTime = new Date();
        }
    }

    /**
     * 更新扩展特性
     * @param feature 扩展特性
     */
    public updateFeature(feature: Feature): void {
        this.feature = feature;
        this.updateTime = new Date();
    }
}

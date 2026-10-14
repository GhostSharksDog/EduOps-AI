import {DataSourceStatus, DataSourceType} from '@/shared/enums/datasource/index';
import {Feature} from "@/shared/types/feature";

/**
 * 数据源实体类(充血模型)
 *
 * 架构交互:
 * 1. 核心实体(DataSource) 的聚合根类
 * 2. 下游支撑: 为标签管理、分群功能、画像分析等模块提供数据基础
 * 3. 数据计算时，通过 DataSourceId 引用具体的数据源配置
 *
 * 对应 Schema: src/shared/schemas/response/datasource.ts::dataSourceSchema
 */
export class DataSource {
    constructor(
        public id: string,
        public name: string,
        public ownedBy: string,
        public createTime: Date,
        public createdBy: string,
        public description?: string,
        public type?: DataSourceType,
        public host?: string,
        public port?: number,
        public databaseName?: string,
        public username?: string,
        public password?: string,
        public status?: DataSourceStatus,
        public isDeleted: boolean = false,
        public feature?: Feature,
        public updateTime?: Date,
        public deleteTime?: Date,
        public updatedBy?: string,
        public deletedBy?: string
    ) {
    }

    /**
     * 更新数据源基本信息
     * @param name 数据源名称
     * @param description 描述
     * @param feature 扩展属性
     */
    public updateInfo(name: string, description?: string, feature?: Feature): void {
        this.name = name;
        if (description !== undefined) {
            this.description = description;
        }
        if (feature !== undefined) {
            this.feature = feature;
        }
        this.updateTime = new Date();
    }

    /**
     * 更新数据源连接信息
     * 注意：密码不应存储在实体中，应通过安全的方式管理
     * @param host 主机地址
     * @param port 端口号
     * @param databaseName 数据库名称
     * @param username 用户名
     */
    public updateConnectionInfo(
        host: string,
        port: number,
        databaseName: string,
        username: string
    ): void {
        this.host = host;
        this.port = port;
        this.databaseName = databaseName;
        this.username = username;
        this.updateTime = new Date();
    }

    /**
     * 启用数据源
     */
    public enable(): void {
        if (this.status !== DataSourceStatus.ACTIVE) {
            this.status = DataSourceStatus.ACTIVE;
            this.updateTime = new Date();
        }
    }

    /**
     * 禁用数据源
     */
    public disable(): void {
        if (this.status !== DataSourceStatus.DISABLED) {
            this.status = DataSourceStatus.DISABLED;
            this.updateTime = new Date();
        }
    }

    /**
     * 删除数据源（软删除）
     * @param deletedBy 删除人
     */
    public delete(deletedBy: string): void {
        if (!this.isDeleted) {
            this.isDeleted = true;
            this.deletedBy = deletedBy;
            this.deleteTime = new Date();
            this.updateTime = new Date();
        }
    }

    /**
     * 恢复数据源（撤销删除）
     */
    public restore(): void {
        if (this.isDeleted) {
            this.isDeleted = false;
            this.deletedBy = undefined;
            this.deleteTime = undefined;
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

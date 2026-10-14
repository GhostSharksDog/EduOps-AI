import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {
    CreateDataSourceCommand,
    DeleteDataSourceCommand,
    DisableDataSourceCommand,
    EnableDataSourceCommand,
    UpdateDataSourceCommand
} from '@/modules/data/contracts/datasource/commands/index';
import {ConnectionTestResult} from "@/modules/data/domain/datasource/types/index";

/**
 * 数据源领域服务接口
 */
export interface DataSourceDomainService {
    /**
     * 创建数据源
     * @param command 创建数据源命令
     * @returns 创建的数据源实体
     */
    createDataSource(command: CreateDataSourceCommand): Promise<DataSource>;

    /**
     * 更新数据源
     * @param command 更新数据源命令
     * @returns 更新后的数据源实体
     */
    updateDataSource(command: UpdateDataSourceCommand): Promise<DataSource>;

    /**
     * 启用数据源
     * @param command 启用数据源命令
     * @returns 启用后的数据源实体
     */
    enableDataSource(command: EnableDataSourceCommand): Promise<DataSource>;

    /**
     * 禁用数据源
     * @param command 禁用数据源命令
     * @returns 禁用后的数据源实体
     */
    disableDataSource(command: DisableDataSourceCommand): Promise<DataSource>;

    /**
     * 删除数据源
     * @param command 删除数据源命令
     */
    deleteDataSource(command: DeleteDataSourceCommand): Promise<void>;

    /**
     * 测试数据源连接
     * @param dataSource 数据源实体
     * @returns 连接测试结果
     */
    testConnection(dataSource: DataSource): Promise<ConnectionTestResult>;
}
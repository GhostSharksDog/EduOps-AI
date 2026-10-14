import {DataSourceDomainService} from '@/modules/data/domain/datasource/services/ports/DataSourceDomainService';
import {DataSourceRepository} from '@/modules/data/domain/ports/DataSourceRepository';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {ConnectionTestResult} from '@/modules/data/domain/datasource/types/index';
import {
    CreateDataSourceCommand,
    DeleteDataSourceCommand,
    DisableDataSourceCommand,
    EnableDataSourceCommand,
    UpdateDataSourceCommand
} from '@/modules/data/contracts/datasource/commands/index';
import {IDatasourceClientAdapter} from '@/platform/database/interface/IDatasourceClientAdapter';
import {TestConnectionEvent} from '@/modules/data/contracts/datasource/events/TestConnectionEvent';
import {TestConnectionResult} from '@/shared/enums/datasource/index';
import {DataSourceStatus} from '@/shared/enums/datasource/DataSourceStatus';
import {createTenantFilter} from '@/platform/get-current-tenant';

/**
 * 数据源领域服务实现
 * @description 处理数据源的核心业务逻辑
 */
export class DataSourceDomainServiceImpl implements DataSourceDomainService {
    constructor(
        private readonly dataSourceRepository: DataSourceRepository,
        private readonly datasourceClientAdapter: IDatasourceClientAdapter
    ) {
    }

    /**
     * 创建数据源
     * @param command 创建数据源命令
     * @returns 创建的数据源实体
     */
    async createDataSource(command: CreateDataSourceCommand): Promise<DataSource> {
        // 检查数据源名称是否已存在（带租户隔离）
        const existingDataSource = await this.dataSourceRepository.findByName(command.name, createTenantFilter(command.ownedBy));
        if (existingDataSource) {
            throw new Error(`该租户下数据源名称 ${command.name} 已存在`);
        }

        // 创建新数据源
        const dataSource = new DataSource(
            crypto.randomUUID(),
            command.name,
            command.ownedBy,
            new Date(),
            command.createdBy || command.ownedBy,
            command.description,
            command.type,
            command.host,
            command.port,
            command.databaseName,
            command.username,
            command.password,
            command.status,
            false, // isDeleted
            command.feature,
            new Date(), // updateTime
            undefined, // deleteTime
            undefined, // updatedBy
            undefined // deletedBy
        );

        // 保存数据源
        return this.dataSourceRepository.save(dataSource);
    }

    /**
     * 更新数据源
     * @param command 更新数据源命令
     * @returns 更新后的数据源实体
     */
    async updateDataSource(command: UpdateDataSourceCommand): Promise<DataSource> {
        const dataSource = await this.dataSourceRepository.findById(command.id);
        if (!dataSource) {
            throw new Error(`数据源不存在: ${command.id}`);
        }

        if (command.name !== undefined && command.name !== dataSource.name) {
            const existingDataSource = await this.dataSourceRepository.findByName(command.name, createTenantFilter(command.ownedBy));
            if (existingDataSource && existingDataSource.id !== command.id) {
                throw new Error(`该租户下数据源名称 ${command.name} 已存在`);
            }
            dataSource.name = command.name;
        }
        if (command.description !== undefined) {
            dataSource.description = command.description;
        }
        if (command.feature !== undefined) {
            dataSource.feature = command.feature;
        }
        if (command.host !== undefined) {
            dataSource.host = command.host;
        }
        if (command.port !== undefined) {
            dataSource.port = typeof command.port === 'string' ? Number(command.port) : command.port;
        }
        if (command.databaseName !== undefined) {
            dataSource.databaseName = command.databaseName;
        }
        if (command.username !== undefined) {
            dataSource.username = command.username;
        }
        if (command.password !== undefined) {
            dataSource.password = command.password;
        }
        if (command.status !== undefined) {
            dataSource.status = typeof command.status === 'string' ? command.status as DataSourceStatus : command.status;
        }
        if (command.updatedBy !== undefined) {
            dataSource.updatedBy = command.updatedBy;
        }
        dataSource.updateTime = new Date();

        // 保存更新后的数据源
        return this.dataSourceRepository.save(dataSource);
    }

    /**
     * 启用数据源
     * @param command 启用数据源命令
     * @returns 启用后的数据源实体
     */
    async enableDataSource(command: EnableDataSourceCommand): Promise<DataSource> {
        // 查找数据源
        const dataSource = await this.dataSourceRepository.findById(command.id);
        if (!dataSource) {
            throw new Error(`数据源不存在: ${command.id}`);
        }

        // 启用数据源
        dataSource.enable();
        if (command.updatedBy) {
            dataSource.updatedBy = command.updatedBy;
        }
        dataSource.updateTime = new Date();

        // 保存更新后的数据源
        return this.dataSourceRepository.save(dataSource);
    }

    /**
     * 禁用数据源
     * @param command 禁用数据源命令
     * @returns 禁用后的数据源实体
     */
    async disableDataSource(command: DisableDataSourceCommand): Promise<DataSource> {
        // 查找数据源
        const dataSource = await this.dataSourceRepository.findById(command.id);
        if (!dataSource) {
            throw new Error(`数据源不存在: ${command.id}`);
        }

        // 禁用数据源
        dataSource.disable();
        if (command.updatedBy) {
            dataSource.updatedBy = command.updatedBy;
        }
        dataSource.updateTime = new Date();

        // 保存更新后的数据源
        return this.dataSourceRepository.save(dataSource);
    }

    /**
     * 删除数据源
     * @param command 删除数据源命令
     */
    async deleteDataSource(command: DeleteDataSourceCommand): Promise<void> {
        // 查找数据源
        const dataSource = await this.dataSourceRepository.findById(command.id);
        if (!dataSource) {
            throw new Error(`数据源不存在: ${command.id}`);
        }

        // 调用实体的删除方法
        dataSource.delete(command.deletedBy);

        // 保存删除后的数据源
        await this.dataSourceRepository.save(dataSource);
    }

    /**
     * 测试数据源连接
     * @param dataSource 数据源实体
     * @returns 连接测试结果
     */
    async testConnection(dataSource: DataSource): Promise<ConnectionTestResult> {
        const startTime = Date.now();

        const event: TestConnectionEvent = await this.datasourceClientAdapter.testConnection(dataSource);
        const responseTime = Date.now() - startTime;

        return {
            success: event.result === TestConnectionResult.SUCCESS,
            message: event.message,
            error: event.errorDetails,
            responseTime
        };
    }
}

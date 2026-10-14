import {DataSourceApplicationService} from '@/modules/data/services/datasource/DataSourceApplicationService';
import {ConnectionTestResultVO, DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {PagedVO} from '@/shared/schemas/common/index';
import {
    CreateDataSourceCommand,
    DeleteDataSourceCommand,
    DisableDataSourceCommand,
    EnableDataSourceCommand,
    TestDataSourceConnectionQuery,
    UpdateDataSourceCommand
} from '@/modules/data/contracts/datasource/commands/index';
import {

    GetDataSourceQuery,
    ListDataSourcesQuery,
    SearchDataSourcesQuery,
} from '@/modules/data/contracts/datasource/queries/index';
import {IDataSourceOHSAdapter} from '@/modules/data/services/datasource/IDataSourceOHSAdapter';
import {DataSourceDomainService} from '@/modules/data/domain/datasource/services/ports/DataSourceDomainService';
import {DataSourceQueryDomainService} from '@/modules/data/domain/datasource/services/ports/DataSourceQueryDomainService';

/**
 * 数据源应用服务实现
 * @description 协调领域服务和适配器，处理业务逻辑
 */
export class DataSourceApplicationServiceImpl implements DataSourceApplicationService {
    constructor(
        private readonly dataSourceDomainService: DataSourceDomainService,
        private readonly dataSourceQueryDomainService: DataSourceQueryDomainService,
        private readonly dataSourceOHSAdapter: IDataSourceOHSAdapter
    ) {
    }

    /**
     * 创建数据源
     * @param command 创建数据源命令
     * @returns 数据源VO
     */
    async createDataSource(command: CreateDataSourceCommand): Promise<DataSourceVO> {
        const dataSource = await this.dataSourceDomainService.createDataSource(command);
        return this.dataSourceOHSAdapter.fromDataSourceToDataSourceVO(dataSource);
    }

    /**
     * 获取数据源
     * @param query 获取数据源查询
     * @returns 数据源VO
     */
    async getDataSource(query: GetDataSourceQuery): Promise<DataSourceVO> {
        const dataSource = await this.dataSourceQueryDomainService.findById(query.id, query.tenantFilter);
        if (!dataSource) {
            throw new Error(`数据源不存在，ID: ${query.id}`);
        }
        return this.dataSourceOHSAdapter.fromDataSourceToDataSourceVO(dataSource);
    }

    /**
     * 更新数据源
     * @param command 更新数据源命令
     * @returns 数据源VO
     */
    async updateDataSource(command: UpdateDataSourceCommand): Promise<DataSourceVO> {
        const dataSource = await this.dataSourceDomainService.updateDataSource(command);
        return this.dataSourceOHSAdapter.fromDataSourceToDataSourceVO(dataSource);
    }

    /**
     * 启用数据源
     * @param command 启用数据源命令
     * @returns 数据源VO
     */
    async enableDataSource(command: EnableDataSourceCommand): Promise<DataSourceVO> {
        const dataSource = await this.dataSourceDomainService.enableDataSource(command);
        return this.dataSourceOHSAdapter.fromDataSourceToDataSourceVO(dataSource);
    }

    /**
     * 禁用数据源
     * @param command 禁用数据源命令
     * @returns 数据源VO
     */
    async disableDataSource(command: DisableDataSourceCommand): Promise<DataSourceVO> {
        const dataSource = await this.dataSourceDomainService.disableDataSource(command);
        return this.dataSourceOHSAdapter.fromDataSourceToDataSourceVO(dataSource);
    }

    /**
     * 删除数据源
     * @param command 删除数据源命令
     */
    async deleteDataSource(command: DeleteDataSourceCommand): Promise<void> {
        return this.dataSourceDomainService.deleteDataSource(command);
    }

    /**
     * 测试数据源连接
     * @param command 测试连接命令
     * @returns 连接测试结果VO
     */
    async testConnection(command: TestDataSourceConnectionQuery): Promise<ConnectionTestResultVO> {
        const dataSource = await this.dataSourceQueryDomainService.findById(command.id);

        if (!dataSource) {
            throw new Error(`数据源不存在，ID: ${command.id}`);
        }

        const result = await this.dataSourceDomainService.testConnection(dataSource);
        return {
            success: result.success,
            message: result.message,
            details: {
                error: result.error,
                responseTime: result.responseTime
            }
        };
    }

    /**
     * 列出数据源
     * @param query 列出数据源查询
     * @returns 分页数据源VO
     */
    async listDataSources(query: ListDataSourcesQuery): Promise<PagedVO<DataSourceVO>> {
        const result = await this.dataSourceQueryDomainService.listDataSources(query);
        return {
            items: this.dataSourceOHSAdapter.fromDataSourceListToDataSourceVOList(result.items),
            totalCount: result.totalCount,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages
        };
    }

    /**
     * 搜索数据源
     * @param query 搜索数据源查询
     * @returns 分页数据源VO
     */
    async searchDataSources(query: SearchDataSourcesQuery): Promise<PagedVO<DataSourceVO>> {
        const result = await this.dataSourceQueryDomainService.searchDataSources(query);
        return {
            items: this.dataSourceOHSAdapter.fromDataSourceListToDataSourceVOList(result.items),
            totalCount: result.totalCount,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages
        };
    }
}
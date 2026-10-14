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
/**
 * 数据源应用服务接口
 */
export interface DataSourceApplicationService {
    /**
     * 创建数据源
     * @param command 创建数据源命令
     * @returns 数据源VO
     */
    createDataSource(command: CreateDataSourceCommand): Promise<DataSourceVO>;

    /**
     * 获取数据源
     * @param query 获取数据源查询
     * @returns 数据源VO
     */
    getDataSource(query: GetDataSourceQuery): Promise<DataSourceVO>;

    /**
     * 更新数据源
     * @param command 更新数据源命令
     * @returns 数据源VO
     */
    updateDataSource(command: UpdateDataSourceCommand): Promise<DataSourceVO>;

    /**
     * 启用数据源
     * @param command 启用数据源命令
     * @returns 数据源VO
     */
    enableDataSource(command: EnableDataSourceCommand): Promise<DataSourceVO>;

    /**
     * 禁用数据源
     * @param command 禁用数据源命令
     * @returns 数据源VO
     */
    disableDataSource(command: DisableDataSourceCommand): Promise<DataSourceVO>;

    /**
     * 删除数据源
     * @param command 删除数据源命令
     */
    deleteDataSource(command: DeleteDataSourceCommand): Promise<void>;

    /**
     * 测试数据源连接
     * @param command 测试连接命令
     * @returns 连接测试结果VO
     */
    testConnection(command: TestDataSourceConnectionQuery): Promise<ConnectionTestResultVO>;

    /**
     * 列出数据源
     * @param query 列出数据源查询
     * @returns 分页数据源VO
     */
    listDataSources(query: ListDataSourcesQuery): Promise<PagedVO<DataSourceVO>>;

    /**
     * 搜索数据源
     * @param query 搜索数据源查询
     * @returns 分页数据源VO
     */
    searchDataSources(query: SearchDataSourcesQuery): Promise<PagedVO<DataSourceVO>>;
}
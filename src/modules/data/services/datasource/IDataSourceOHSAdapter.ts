import {NextRequest} from 'next/server';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {CreateDataSourceDTO, UpdateDataSourceDTO} from '@/modules/data/contracts/schemas/request/datasource/index';
import {
    CreateDataSourceCommand,
    DeleteDataSourceCommand,
    DisableDataSourceCommand,
    EnableDataSourceCommand,
    TestDataSourceConnectionQuery,
    UpdateDataSourceCommand
} from '@/modules/data/contracts/datasource/commands/index';
import {GetDataSourceQuery, ListDataSourcesQuery,} from '@/modules/data/contracts/datasource/queries/index';

/**
 * 数据源OHS适配器接口
 * @description 负责HTTP请求与领域对象之间的转换
 */
export interface IDataSourceOHSAdapter {
    /**
     * 将HTTP请求转换为列表查询对象
     * @param request HTTP请求对象
     * @returns ListDataSourcesQuery
     */
    fromRequestToListDataSourcesQuery(request: NextRequest): ListDataSourcesQuery;

    /**
     * 将HTTP请求转换为获取单个对象查询
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns GetDataSourceQuery
     */
    fromRequestToGetDataSourceQuery(request: NextRequest, id: string): GetDataSourceQuery;

    /**
     * 将HTTP请求转换为创建命令
     * @param request HTTP请求对象
     * @returns Promise<CreateDataSourceCommand>
     */
    fromRequestToCreateDataSourceCommand(request: NextRequest): Promise<CreateDataSourceCommand>;

    /**
     * 将HTTP请求转换为更新命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns Promise<UpdateDataSourceCommand>
     */
    fromRequestToUpdateDataSourceCommand(request: NextRequest, id: string): Promise<UpdateDataSourceCommand>;

    /**
     * 将HTTP请求转换为删除命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns DeleteDataSourceCommand
     */
    fromRequestToDeleteDataSourceCommand(request: NextRequest, id: string): DeleteDataSourceCommand;

    /**
     * 将HTTP请求转换为启用命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns EnableDataSourceCommand
     */
    fromRequestToEnableDataSourceCommand(request: NextRequest, id: string): EnableDataSourceCommand;

    /**
     * 将HTTP请求转换为禁用命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns DisableDataSourceCommand
     */
    fromRequestToDisableDataSourceCommand(request: NextRequest, id: string): DisableDataSourceCommand;

    /**
     * 将HTTP请求转换为测试连接命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns Promise<TestDataSourceConnectionQuery>
     */
    fromRequestToTestDataSourceConnectionQuery(request: NextRequest, id: string): Promise<TestDataSourceConnectionQuery>;

    /**
     * 将DataSource实体转换为DataSourceVO
     * @param dataSource DataSource实体
     * @returns DataSourceVO
     */
    fromDataSourceToDataSourceVO(dataSource: DataSource): DataSourceVO;

    /**
     * 批量转换DataSource实体为DataSourceVO数组
     * @param dataSources DataSource实体数组
     * @returns DataSourceVO数组
     */
    fromDataSourceListToDataSourceVOList(dataSources: DataSource[]): DataSourceVO[];

    /**
     * 将CreateDataSourceDTO转换为DataSource实体
     * @param dto 创建DTO
     * @returns Partial<DataSource> 初始实体数据
     */
    fromDTOToDataSourceEntity(dto: CreateDataSourceDTO): Partial<DataSource>;

    /**
     * 将UpdateDataSourceDTO应用到DataSource实体
     * @param dataSource 现有DataSource实体
     * @param dto 更新DTO
     * @returns DataSource 更新后的实体
     */
    fromDTOToUpdateDataSourceEntity(dataSource: DataSource, dto: UpdateDataSourceDTO): DataSource;
}

import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {ListDataSourcesQuery, SearchDataSourcesQuery} from '@/modules/data/contracts/datasource/queries/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 数据源查询领域服务接口
 */
export interface DataSourceQueryDomainService {
    /**
     * 按ID查找数据源
     * @param id 数据源ID
     * @param tenantFilter 租户过滤条件
     * @returns 数据源实体
     */
    findById(id: string, tenantFilter?: TenantFilterOptions): Promise<DataSource | null>;

    /**
     * 按名称查找数据源
     * @param name 数据源名称
     * @returns 数据源实体
     */
    findByName(name: string): Promise<DataSource | null>;

    /**
     * 查找所有数据源
     * @param filter 过滤条件
     * @returns 数据源实体列表
     */
    findAll(filter?: Record<string, unknown>): Promise<DataSource[]>;

    /**
     * 列出数据源（带分页）
     * @param query 列表查询参数
     * @returns 分页数据源列表
     */
    listDataSources(query: ListDataSourcesQuery): Promise<{
        items: DataSource[];
        totalCount: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;

    /**
     * 搜索数据源（带分页）
     * @param query 搜索查询参数
     * @returns 分页数据源列表
     */
    searchDataSources(query: SearchDataSourcesQuery): Promise<{
        items: DataSource[];
        totalCount: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;

    /**
     * 根据条件统计数据源数量
     * @param filter 统计条件
     * @returns 数据源数量
     */
    countByCriteria(filter: Record<string, unknown>): Promise<number>;
}
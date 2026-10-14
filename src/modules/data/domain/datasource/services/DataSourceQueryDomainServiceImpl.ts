import {DataSourceQueryDomainService} from '@/modules/data/domain/datasource/services/ports/index';
import {DataSourceRepository} from '@/modules/data/domain/ports/DataSourceRepository';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {ListDataSourcesQuery, SearchDataSourcesQuery} from '@/modules/data/contracts/datasource/queries/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 数据源查询领域服务实现
 * @description 处理数据源的查询业务逻辑
 */
export class DataSourceQueryDomainServiceImpl implements DataSourceQueryDomainService {
    constructor(private readonly dataSourceRepository: DataSourceRepository) {
    }

    /**
     * 按ID查找数据源
     * @param id 数据源ID
     * @param tenantFilter 租户过滤条件
     * @returns 数据源实体
     */
    async findById(id: string, tenantFilter?: TenantFilterOptions): Promise<DataSource | null> {
        return this.dataSourceRepository.findById(id, tenantFilter);
    }

    /**
     * 按名称查找数据源
     * @param name 数据源名称
     * @returns 数据源实体
     */
    async findByName(name: string): Promise<DataSource | null> {
        return this.dataSourceRepository.findByName(name);
    }

    /**
     * 查找所有数据源
     * @param filter 过滤条件
     * @returns 数据源实体列表
     */
    async findAll(filter?: Record<string, unknown>): Promise<DataSource[]> {
        return this.dataSourceRepository.findAll(filter);
    }

    /**
     * 列出数据源（带分页）
     * @param query 列表查询参数
     * @returns 分页数据源列表
     */
    async listDataSources(query: ListDataSourcesQuery): Promise<{
    items: DataSource[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}> {
    const {page = 1, pageSize = 10, type, status, keyword, tenantFilter} = query;

    const filter: Record<string, unknown> = {
        skip: (page - 1) * pageSize,
        take: pageSize
    };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (keyword) filter.name = keyword;
    if (tenantFilter) filter.tenantFilter = tenantFilter;

    const items = await this.dataSourceRepository.findAll(filter);
    const totalCount = await this.dataSourceRepository.count(filter);

    return {
        items,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
    };
}

    /**
     * 搜索数据源（带分页）
     * @param query 搜索查询参数
     * @returns 分页数据源列表
     */
    async searchDataSources(query: SearchDataSourcesQuery): Promise<{
        items: DataSource[];
        totalCount: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        const {page = 1, pageSize = 10, type, status, ownedBy, tenantFilter} = query;

        const filter: Record<string, unknown> = {
            skip: (page - 1) * pageSize,
            take: pageSize
        };
        if (type) filter.type = type;
        if (status) filter.status = status;
        if (ownedBy) filter.ownedBy = ownedBy;
        if (tenantFilter) filter.tenantFilter = tenantFilter;

        const items = await this.dataSourceRepository.findAll(filter);
        const totalCount = await this.dataSourceRepository.count(filter);

        return {
            items,
            totalCount,
            page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize)
        };
    }

    /**
     * 根据条件统计数据源数量
     * @param filter 统计条件
     * @returns 数据源数量
     */
    async countByCriteria(filter: Record<string, unknown>): Promise<number> {
        return this.dataSourceRepository.count(filter);
    }
}

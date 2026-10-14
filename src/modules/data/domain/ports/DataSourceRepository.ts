/* eslint-disable @typescript-eslint/no-explicit-any */
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 数据源仓库端口接口
 * 定义数据源的数据访问契约
 * 领域层通过此接口访问ACL层
 */
export interface DataSourceRepository {
    /**
     * 保存数据源
     * @param dataSource 数据源领域实体
     * @param tenantFilter 租户过滤选项
     * @returns 保存后的数据源领域实体
     */
    save(dataSource: DataSource, tenantFilter?: TenantFilterOptions): Promise<DataSource>;

    /**
     * 根据ID查找数据源
     * @param id 数据源ID
     * @returns 数据源领域实体或null
     */
    findById(id: string, tenantFilter?: TenantFilterOptions): Promise<DataSource | null>;

    /**
     * 根据名称查找数据源
     * @param name 数据源名称
     * @returns 数据源领域实体或null
     */
    findByName(name: string, tenantFilter?: TenantFilterOptions): Promise<DataSource | null>;

    /**
     * 查找所有数据源
     * @param filter 过滤条件
     * @returns 数据源领域实体列表
     */
    findAll(filter?: Record<string, any>): Promise<DataSource[]>;

    /**
     * 根据条件统计数据源数量
     * @param filter 统计条件
     * @returns 数据源数量
     */
    count(filter: Record<string, any>): Promise<number>;

    /**
     * 删除数据源（软删除）
     * @param id 数据源ID
     */
    delete(id: string): Promise<void>;
}
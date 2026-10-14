import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {DataModelQueryParams} from '@/modules/data/contracts/data-model/queries/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

type DataModelQuery = DataModelQueryParams;

/**
 * 数据模型仓库端口接口
 */
export interface DataModelRepository {
    /**
     * 创建数据模型
     * @param dataModel 数据模型实体
     * @returns 创建的数据模型
     */
    create(dataModel: DataModel): Promise<DataModel>;

    /**
     * 根据ID获取数据模型（不包含已删除的列）
     * @param id 数据模型ID
     * @param tenantFilter 租户过滤条件
     * @returns 数据模型实体，找不到则返回null
     */
    findById(id: string, tenantFilter?: TenantFilterOptions): Promise<DataModel | null>;

    /**
     * 根据ID获取数据模型（包含已删除的列，用于更新操作）
     * 当需要处理列的删除/恢复操作时，需要加载所有列（包括已软删除的）
     * @param id 数据模型ID
     * @param tenantFilter 租户过滤条件
     * @returns 数据模型实体，找不到则返回null
     */
    findByIdForUpdate(id: string, tenantFilter?: TenantFilterOptions): Promise<DataModel | null>;

    /**
     * 根据名称获取数据模型
     * @param name 数据模型名称
     * @returns 数据模型实体，找不到则返回null
     */
    findByName(name: string, tenantFilter?: TenantFilterOptions): Promise<DataModel | null>;

    /**
     * 获取数据模型列表
     * @param query 查询条件
     * @returns 数据模型列表
     */
    findAll(query?: DataModelQuery): Promise<DataModel[]>;

    /**
     * 更新数据模型
     * @param dataModel 数据模型实体
     * @param tenantFilter 租户过滤选项
     * @returns 更新后的数据模型
     */
    update(dataModel: DataModel, tenantFilter?: TenantFilterOptions): Promise<DataModel>;

    /**
     * 删除数据模型
     * @param id 数据模型ID
     */
    delete(id: string): Promise<void>;

    /**
     * 统计数据模型数量
     * @param query 查询条件
     * @returns 数据模型数量
     */
    count(query?: DataModelQuery): Promise<number>;
}

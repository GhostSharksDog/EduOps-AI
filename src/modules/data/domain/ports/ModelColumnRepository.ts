import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 模型列仓库端口接口
 */
export interface ModelColumnRepository {
    /**
     * 创建模型列
     * @param column 模型列实体
     * @param tenantFilter 租户过滤选项
     * @returns 创建的模型列
     */
    create(column: ModelColumn, tenantFilter?: TenantFilterOptions): Promise<ModelColumn>;

    /**
     * 根据ID获取模型列
     * @param id 模型列ID
     * @param tenantFilter 租户过滤选项
     * @returns 模型列实体，找不到则返回null
     */
    findById(id: string, tenantFilter?: TenantFilterOptions): Promise<ModelColumn | null>;

    /**
     * 根据模型ID获取所有列
     * @param modelId 模型ID
     * @param tenantFilter 租户过滤选项
     * @returns 模型列列表
     */
    findByModelId(modelId: string, tenantFilter?: TenantFilterOptions): Promise<ModelColumn[]>;

    /**
     * 更新模型列
     * @param column 模型列实体
     * @param tenantFilter 租户过滤选项
     * @returns 更新后的模型列
     */
    update(column: ModelColumn, tenantFilter?: TenantFilterOptions): Promise<ModelColumn>;

    /**
     * 删除模型列
     * @param id 模型列ID
     * @param tenantFilter 租户过滤选项
     */
    delete(id: string, tenantFilter?: TenantFilterOptions): Promise<void>;

    /**
     * 根据模型ID删除所有列
     * @param modelId 模型ID
     * @param tenantFilter 租户过滤选项
     */
    deleteByModelId(modelId: string, tenantFilter?: TenantFilterOptions): Promise<void>;
}

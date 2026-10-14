import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {ModelColumnAddCommand, ModelColumnUpdateCommand} from '@/modules/data/contracts/data-model/commands/index';

/**
 * 模型列领域服务接口
 */
export interface ModelColumnDomainService {
    /**
     * 添加模型列
     * @param command 添加模型列命令
     * @returns 添加的模型列
     */
    addColumn(command: ModelColumnAddCommand): Promise<ModelColumn>;

    /**
     * 更新模型列
     * @param command 更新模型列命令
     * @returns 更新后的模型列
     */
    updateColumn(command: ModelColumnUpdateCommand): Promise<ModelColumn>;

    /**
     * 移除模型列
     * @param columnId 模型列ID
     */
    removeColumn(columnId: string): Promise<void>;

    /**
     * 获取模型列列表
     * @param modelId 数据模型ID
     * @returns 模型列列表
     */
    listColumns(modelId: string): Promise<ModelColumn[]>;
}

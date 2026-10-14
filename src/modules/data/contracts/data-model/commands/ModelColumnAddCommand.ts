import {ModelColumnCreateCommand} from '@/modules/data/contracts/data-model/commands/ModelColumnCreateCommand';

/**
 * 添加模型列命令
 */
export interface ModelColumnAddCommand {
    /** 模型ID */
    modelId: string;

    /** 列定义 */
    column: ModelColumnCreateCommand;
    
    /** 创建人ID */
    createdBy: string;
    
    /** 租户ID */
    ownedBy?: string;
}

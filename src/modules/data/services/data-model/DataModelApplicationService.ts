import type {DataModelDetailVO, DataModelVO, ModelColumnVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import type {PagedVO} from '@/shared/schemas/common/index';

import type {
    ActivateDataModelCommand,
    CreateDataModelCommand,
    DeactivateDataModelCommand,
    DeleteDataModelCommand,
    UpdateDataModelCommand
} from '@/modules/data/contracts/data-model/commands/index';
import type {ListDataModelsQuery} from '@/modules/data/contracts/data-model/queries/ListDataModelsQuery';
import type {GetDataModelQuery} from '@/modules/data/contracts/data-model/queries/GetDataModelQuery';
import type {ListModelColumnsQuery} from '@/modules/data/contracts/data-model/queries/ListModelColumnsQuery';


export interface DataModelApplicationService {
    /**
     * 创建数据模型
     */
    createDataModel(command: CreateDataModelCommand): Promise<DataModelDetailVO>;

    /**
     * 获取数据模型详情
     */
    getDataModel(query: GetDataModelQuery): Promise<DataModelDetailVO>;

    /**
     * 更新数据模型
     */
    updateDataModel(command: UpdateDataModelCommand): Promise<DataModelDetailVO>;

    /**
     * 删除数据模型
     */
    deleteDataModel(command: DeleteDataModelCommand): Promise<void>;

    /**
     * 激活数据模型
     */
    activateDataModel(command: ActivateDataModelCommand): Promise<DataModelVO>;

    /**
     * 停用数据模型
     */
    deactivateDataModel(command: DeactivateDataModelCommand): Promise<DataModelVO>;

    /**
     * 获取数据模型列表
     */
    listDataModels(query: ListDataModelsQuery): Promise<PagedVO<DataModelVO>>;

    /**
     * 获取模型列列表
     */
    listModelColumns(query: ListModelColumnsQuery): Promise<ModelColumnVO[]>;
}

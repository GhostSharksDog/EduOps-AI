import {
    ActivateDataModelCommand,
    CreateDataModelCommand,
    UpdateDataModelCommand,
    DeactivateDataModelCommand,
    DeleteDataModelCommand
} from '@/modules/data/contracts/data-model/commands/index';
import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {DataModelQueryParams} from '@/modules/data/contracts/data-model/queries/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

type DataModelCreateCommand = CreateDataModelCommand;
type DataModelUpdateCommand = UpdateDataModelCommand;
type DataModelQuery = DataModelQueryParams;

export interface DataModelDomainService {
    createDataModel(command: DataModelCreateCommand): Promise<DataModel>;

    getDataModel(modelId: string, tenantFilter?: TenantFilterOptions): Promise<DataModel>;

    /**
     * 更新数据模型
     */
    updateDataModel(command: DataModelUpdateCommand): Promise<DataModel>;

    /**
     * 删除数据模型
     */
    deleteDataModel(command: DeleteDataModelCommand): Promise<void>;

    /**
     * 激活数据模型
     */
    activateDataModel(command: ActivateDataModelCommand): Promise<DataModel>;

    /**
     * 停用数据模型
     */
    deactivateDataModel(command: DeactivateDataModelCommand): Promise<DataModel>;

    /**
     * 获取数据模型列表
     */
    listDataModels(query: DataModelQuery): Promise<DataModel[]>;

    /**
     * 获取模型列列表
     */
    listModelColumns(modelId: string): Promise<ModelColumn[]>;
}
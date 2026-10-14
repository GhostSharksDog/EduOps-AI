import {DataModelDomainService} from '@/modules/data/domain/data-model/services/index';
import {
    ActivateDataModelCommand,
    CreateDataModelCommand,
    DeactivateDataModelCommand,
    DeleteDataModelCommand,
    UpdateDataModelCommand
} from '@/modules/data/contracts/data-model/commands/index';
import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {DataModelQueryParams} from '@/modules/data/contracts/data-model/queries/index';
import {DataModelRepository} from '@/modules/data/domain/ports/DataModelRepository';
import {DataModelFactoryImpl} from '@/modules/data/domain/data-model/factories/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';
export class DataModelDomainServiceImpl implements DataModelDomainService {
    private readonly factory: DataModelFactoryImpl = new DataModelFactoryImpl();

    constructor(
        private readonly repository: DataModelRepository
    ) {
    }

    async createDataModel(command: CreateDataModelCommand): Promise<DataModel> {
        const existingModel = await this.repository.findByName(command.name);
        if (existingModel) {
            throw new Error('数据模型名称已存在');
        }

        const dataModel = this.factory.createDataModel(command);

        return await this.repository.create(dataModel);
    }

    async getDataModel(modelId: string, tenantFilter?: TenantFilterOptions): Promise<DataModel> {
        const dataModel = await this.repository.findById(modelId, tenantFilter);
        if (!dataModel || dataModel.isDeleted) {
            throw new Error('数据模型不存在');
        }
        return dataModel;
    }

    async updateDataModel(command: UpdateDataModelCommand): Promise<DataModel> {
        // 使用 findByIdForUpdate 加载包含已删除列的数据模型
        // 这样可以正确处理对已软删除列的操作（删除/恢复/更新）
        const dataModel = await this.repository.findByIdForUpdate(command.id);
        if (!dataModel || dataModel.isDeleted) {
            throw new Error('数据模型不存在');
        }

        if (command.name && command.name !== dataModel.name) {
            const existingModel = await this.repository.findByName(command.name);
            if (existingModel) {
                throw new Error('数据模型名称已存在');
            }
        }

        this.factory.updateDataModel(dataModel, command);

        // 处理列操作（CREATE/UPDATE/DELETE）
        if (command.columns && command.columns.length > 0) {
            const processedColumns = this.factory.createOrUpdateColumns(dataModel, command.columns);
            // processedColumns 只包含本次操作的列
            // UPDATE/DELETE 已在原对象上修改（引用），CREATE 产生新列需要添加
            const existingColumnIds = new Set(dataModel.columns.map(c => c.id));
            const newColumns = processedColumns.filter(col => !existingColumnIds.has(col.id));
            dataModel.columns = [...dataModel.columns, ...newColumns];
        }

        return await this.repository.update(dataModel);
    }

    async deleteDataModel(command: DeleteDataModelCommand): Promise<void> {
        // 获取现有模型
        const dataModel = await this.getDataModel(command.modelId);

        // 调用实体的删除方法
        dataModel.delete(command.deletedBy);

        // 保存删除后的模型
        await this.repository.update(dataModel);
    }

    async activateDataModel(command: ActivateDataModelCommand): Promise<DataModel> {
        // 获取现有模型
        const dataModel = await this.getDataModel(command.modelId);

        // 激活模型
        dataModel.activate();

        // 设置更新人
        dataModel.updatedBy = command.updatedBy;

        // 保存更新
        return await this.repository.update(dataModel);
    }

    async deactivateDataModel(command: DeactivateDataModelCommand): Promise<DataModel> {
        // 获取现有模型
        const dataModel = await this.getDataModel(command.modelId);

        // 停用模型
        dataModel.deactivate();

        // 设置更新人
        dataModel.updatedBy = command.updatedBy;

        // 保存更新
        return await this.repository.update(dataModel);
    }

    async listDataModels(query: DataModelQueryParams): Promise<DataModel[]> {
        // 从仓库获取模型列表
        return await this.repository.findAll(query);
    }

    async listModelColumns(modelId: string): Promise<ModelColumn[]> {
        // 获取现有模型
        const dataModel = await this.getDataModel(modelId);

        // 返回列列表（过滤软删除的列)
        return dataModel.columns.filter(col => !col.isDeleted);
    }
}
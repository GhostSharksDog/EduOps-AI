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
import type {DataModelDetailVO, DataModelVO, ModelColumnVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import type {PagedVO} from '@/shared/schemas/common/index';
import type {DataModelRepository} from '../../domain/ports/DataModelRepository';
import type {DataModelDomainService} from '../../domain/data-model/services/ports/DataModelDomainService';
import type {IDataModelOHSAdapter} from './IDataModelOHSAdapter';
import type {DataModelApplicationService} from './DataModelApplicationService';

export class DataModelApplicationServiceImpl implements DataModelApplicationService {
    constructor(
        private readonly repository: DataModelRepository,
        private readonly domain: DataModelDomainService,
        private readonly adapter: IDataModelOHSAdapter,
    ) {}

    async createDataModel(command: CreateDataModelCommand): Promise<DataModelDetailVO> {

        const dataModel = await this.domain.createDataModel(command);
        return this.adapter.fromDataModelToDataModelDetailVO(dataModel);
    }

    async getDataModel(query: GetDataModelQuery): Promise<DataModelDetailVO> {
        const dataModel = await this.domain.getDataModel(query.modelId, query.tenantFilter);
        return this.adapter.fromDataModelToDataModelDetailVO(dataModel);
    }

    async updateDataModel(command: UpdateDataModelCommand): Promise<DataModelDetailVO> {
        const dataModel = await this.domain.updateDataModel(command);
        return this.adapter.fromDataModelToDataModelDetailVO(dataModel);
    }

    async deleteDataModel(command: DeleteDataModelCommand): Promise<void> {
        await this.domain.deleteDataModel(command);
    }

    async activateDataModel(command: ActivateDataModelCommand): Promise<DataModelVO> {
        const dataModel = await this.domain.activateDataModel(command);
        return this.adapter.fromDataModelToDataModelVO(dataModel);
    }

    async deactivateDataModel(command: DeactivateDataModelCommand): Promise<DataModelVO> {
        const dataModel = await this.domain.deactivateDataModel(command);
        return this.adapter.fromDataModelToDataModelVO(dataModel);
    }

    async listDataModels(query: ListDataModelsQuery): Promise<PagedVO<DataModelVO>> {
        const dataModels = await this.domain.listDataModels(query);
        const vos = dataModels.map(dataModel => this.adapter.fromDataModelToDataModelVO(dataModel));

        // Get actual total count from repository for pagination
        const totalCount = await this.repository.count({
            name: query.name,
            status: query.status,
            datasourceId: query.datasourceId,
            tenantFilter: query.tenantFilter
        } as Record<string, unknown>);

        return {
            items: vos,
            totalCount: totalCount,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.ceil(totalCount / query.pageSize)
        };
    }

    async listModelColumns(query: ListModelColumnsQuery): Promise<ModelColumnVO[]> {
        // 获取数据模型
        const dataModel = await this.domain.getDataModel(query.modelId);

        // 返回模型列的VO列表
        return dataModel.columns.map(column => this.adapter.toColumnResponse(column));
    }
}

import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {CreateDataModelCommand, UpdateDataModelCommand} from '@/modules/data/contracts/data-model/commands/index';
import {ModelColumnUpdateCommand} from '@/modules/data/contracts/data-model/commands/ModelColumnUpdateCommand';

export interface IDataModelFactory {
    createDataModel(command: CreateDataModelCommand): DataModel;

    updateDataModel(
        dataModel: DataModel,
        command: UpdateDataModelCommand
    ): DataModel;

    createOrUpdateColumns(
        dataModel: DataModel,
        columns: ModelColumnUpdateCommand[]
    ): ModelColumn[];
}

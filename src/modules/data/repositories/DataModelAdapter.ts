import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {DataModelPO} from '@/modules/data/repositories/persistence/data-model/index';
import {ModelColumnPO} from '@/modules/data/repositories/persistence/data-model/ModelColumnPO';

/**
 * 数据模型适配器接口
 */
export interface DataModelAdapter {
    /**
     * 将数据模型领域对象转换为数据模型PO
     * @param dataModel 数据模型领域对象
     * @returns 数据模型PO
     */
    fromDataModelToDataModelPO(dataModel: DataModel): DataModelPO;

    /**
     * 将数据模型PO转换为数据模型领域对象
     * @param dataModelPO 数据模型PO（可能包含dataSource关联数据）
     * @param modelColumnPOs 模型列PO列表
     * @returns 数据模型领域对象
     */
    fromDataModelPOToDataModel(dataModelPO: DataModelPO, modelColumnPOs: ModelColumnPO[]): DataModel;

    /**
     * 批量将数据模型PO转换为数据模型领域对象
     * @param dataModelPOs 数据模型PO列表（可能包含dataSource关联数据）
     * @param modelColumnPOs 模型列PO列表
     * @returns 数据模型领域对象列表
     */
    fromDataModelPOListToDataModelList(dataModelPOs: DataModelPO[], modelColumnPOs: ModelColumnPO[]): DataModel[];
}

/**
 * 模型列适配器接口
 */
export interface ModelColumnAdapter {
    /**
     * 将模型列领域对象转换为模型列PO
     * @param modelColumn 模型列领域对象
     * @returns 模型列PO
     */
    fromModelColumnToModelColumnPO(modelColumn: ModelColumn): ModelColumnPO;

    /**
     * 将模型列PO转换为模型列领域对象
     * @param modelColumnPO 模型列PO
     * @returns 模型列领域对象
     */
    fromModelColumnPOToModelColumn(modelColumnPO: ModelColumnPO): ModelColumn;

    /**
     * 批量将模型列PO转换为模型列领域对象
     * @param modelColumnPOs 模型列PO列表
     * @returns 模型列领域对象列表
     */
    fromModelColumnPOListToModelColumnList(modelColumnPOs: ModelColumnPO[]): ModelColumn[];
}

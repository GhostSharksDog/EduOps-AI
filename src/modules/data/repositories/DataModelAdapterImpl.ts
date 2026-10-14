import {DataModelAdapter, ModelColumnAdapter} from '@/modules/data/repositories/DataModelAdapter';
import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {DataModelPO} from '@/modules/data/repositories/persistence/data-model/index';
import {ModelColumnPO} from '@/modules/data/repositories/persistence/data-model/ModelColumnPO';
import {DataSourcePO} from '@/modules/data/repositories/persistence/data-source/index';
import {DataModelStatus, DataType} from '@/shared/enums/index';
import {DataSourceType} from '@/shared/enums/datasource/DataSourceType';
import {DataSourceStatus} from '@/shared/enums/datasource/DataSourceStatus';

/**
 * 数据模型适配器实现
 */
export class DataModelAdapterImpl implements DataModelAdapter {
    constructor(
        private readonly modelColumnAdapter: ModelColumnAdapter
    ) {
    }

    /**
     * 将数据模型领域对象转换为数据模型PO
     * @param dataModel 数据模型领域对象
     * @returns 数据模型PO
     */
    fromDataModelToDataModelPO(dataModel: DataModel): DataModelPO {
        return {
            id: dataModel.id,
            name: dataModel.name,
            description: dataModel.description || null,
            datasourceId: dataModel.datasource.id,  // 使用 datasource.id
            tableName: dataModel.tableName || null,
            status: dataModel.status,
            ownedBy: dataModel.ownedBy,
            feature: dataModel.feature || null,
            isDeleted: dataModel.isDeleted,
            createTime: dataModel.createTime,
            updateTime: dataModel.updateTime || null,
            deleteTime: dataModel.deleteTime || null,
            createdBy: dataModel.createdBy,
            updatedBy: dataModel.updatedBy || null,
            deletedBy: dataModel.deletedBy || null
        };
    }

    /**
     * 将数据模型PO转换为数据模型领域对象
     * @param dataModelPO 数据模型PO（可能包含dataSource关联数据）
     * @param modelColumnPOs 模型列PO列表
     * @returns 数据模型领域对象
     */
    fromDataModelPOToDataModel(dataModelPO: DataModelPO, modelColumnPOs: ModelColumnPO[]): DataModel {
        // 将模型列PO转换为领域对象
        const modelColumns = modelColumnPOs
            .filter(po => po.modelId === dataModelPO.id)
            .map(po => this.modelColumnAdapter.fromModelColumnPOToModelColumn(po));

        // 确保feature是一个对象
        const feature = typeof dataModelPO.feature === 'object' && dataModelPO.feature !== null
            ? dataModelPO.feature
            : {};

        // 仓储补齐数据源关联后一起映射。
        const datasourceData = (dataModelPO as DataModelPO & { dataSource?: DataSourcePO }).dataSource;

        const isValidUUID = (value: string | null | undefined): value is string => {
            return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        };

        // 根据是否有完整的 datasource 数据来创建 DataSource 实例
        const datasource = datasourceData
            ? new DataSource(
                datasourceData.id,
                datasourceData.name || '',
                isValidUUID(datasourceData.ownedBy) ? datasourceData.ownedBy : '',
                datasourceData.createTime || new Date(),
                isValidUUID(datasourceData.createdBy) ? datasourceData.createdBy : '',
                datasourceData.description || undefined,
                datasourceData.type as DataSourceType | undefined,
                datasourceData.host,
                datasourceData.port,
                datasourceData.databaseName,
                datasourceData.username,
                undefined,
                datasourceData.status as DataSourceStatus | undefined,
                datasourceData.isDeleted || false,
                datasourceData.feature || {},
                datasourceData.updateTime || undefined,
                datasourceData.deleteTime || undefined,
                isValidUUID(datasourceData.updatedBy) ? datasourceData.updatedBy : undefined,
                isValidUUID(datasourceData.deletedBy) ? datasourceData.deletedBy : undefined
            )
            : new DataSource(dataModelPO.datasourceId || '', '', '', new Date(), '');

        return new DataModel(
            dataModelPO.id,
            dataModelPO.name,
            dataModelPO.status as DataModelStatus,
            datasource,
            dataModelPO.ownedBy,
            dataModelPO.createTime ,
            dataModelPO.createdBy,
            dataModelPO.description || undefined,
            dataModelPO.tableName || undefined,
            modelColumns,
            feature,
            dataModelPO.isDeleted,
            dataModelPO.updateTime || undefined,
            dataModelPO.deleteTime || undefined,
            dataModelPO.updatedBy || undefined,
            dataModelPO.deletedBy || undefined
        );
    }

    /**
     * 批量将数据模型PO转换为数据模型领域对象
     * @param dataModelPOs 数据模型PO列表
     * @param modelColumnPOs 模型列PO列表
     * @returns 数据模型领域对象列表
     */
    fromDataModelPOListToDataModelList(dataModelPOs: DataModelPO[], modelColumnPOs: ModelColumnPO[]): DataModel[] {
        return dataModelPOs.map(dataModelPO => {
            const columnsForModel = modelColumnPOs.filter(po => po.modelId === dataModelPO.id);
            return this.fromDataModelPOToDataModel(dataModelPO, columnsForModel);
        });
    }
}

/**
 * 模型列适配器实现
 */
export class ModelColumnAdapterImpl implements ModelColumnAdapter {
    /**
     * 将模型列领域对象转换为模型列PO
     * @param modelColumn 模型列领域对象
     * @returns 模型列PO
     */
    fromModelColumnToModelColumnPO(modelColumn: ModelColumn): ModelColumnPO {
        return {
            id: modelColumn.id,
            modelId: modelColumn.modelId,
            name: modelColumn.name,
            displayName: modelColumn.displayName || null,
            dataType: modelColumn.dataType as string,
            length: modelColumn.length || null,
            precision: modelColumn.precision || null,
            scale: modelColumn.scale || null,
            isNullable: modelColumn.isNullable || false,
            defaultValue: modelColumn.defaultValue !== null ? String(modelColumn.defaultValue) : null,
            description: modelColumn.description || null,
            orderIndex: modelColumn.orderIndex || 0,
            isPrimaryKey: modelColumn.isPrimaryKey || false,
            ownedBy: modelColumn.ownedBy,
            feature: modelColumn.feature || null,
            isDeleted: modelColumn.isDeleted,
            createTime: modelColumn.createTime || null,
            updateTime: modelColumn.updateTime || null,
            deleteTime: modelColumn.deleteTime || null,
            createdBy: modelColumn.createdBy ,
            updatedBy: modelColumn.updatedBy || null,
            deletedBy: modelColumn.deletedBy || null
        };
    }

    /**
     * 将模型列PO转换为模型列领域对象
     * @param modelColumnPO 模型列PO
     * @returns 模型列领域对象
     */
    fromModelColumnPOToModelColumn(modelColumnPO: ModelColumnPO): ModelColumn {
        const feature = typeof modelColumnPO.feature === 'object' && modelColumnPO.feature !== null
            ? modelColumnPO.feature
            : {};

        // 转换 updateTime 为 Date 类型
        const updateTime = modelColumnPO.updateTime
            ? new Date(modelColumnPO.updateTime)
            : undefined;

        return new ModelColumn(
            modelColumnPO.id,
            modelColumnPO.modelId,
            modelColumnPO.name,
            modelColumnPO.ownedBy,
            modelColumnPO.createTime || new Date(),
            modelColumnPO.createdBy,
            modelColumnPO.description ?? undefined,
            feature,
            modelColumnPO.isDeleted,
            updateTime,
            modelColumnPO.deleteTime,
            modelColumnPO.updatedBy,
            modelColumnPO.deletedBy,
            modelColumnPO.displayName || undefined,
            modelColumnPO.dataType as DataType,
            modelColumnPO.length,
            modelColumnPO.precision,
            modelColumnPO.scale,
            modelColumnPO.isNullable,
            modelColumnPO.defaultValue,
            modelColumnPO.orderIndex,
            modelColumnPO.isPrimaryKey
        );
    }

    /**
     * 批量将模型列PO转换为模型列领域对象
     * @param modelColumnPOs 模型列PO列表
     * @returns 模型列领域对象列表
     */
    fromModelColumnPOListToModelColumnList(modelColumnPOs: ModelColumnPO[]): ModelColumn[] {
        return modelColumnPOs.map(this.fromModelColumnPOToModelColumn.bind(this));
    }
}

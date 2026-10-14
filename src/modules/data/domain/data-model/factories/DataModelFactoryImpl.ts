import {IDataModelFactory} from '@/modules/data/domain/data-model/factories/ports/IDataModelFactory';
import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {CreateDataModelCommand, UpdateDataModelCommand} from '@/modules/data/contracts/data-model/commands/index';
import {ColumnOperation, ModelColumnUpdateCommand} from '@/modules/data/contracts/data-model/commands/ModelColumnUpdateCommand';
import {config} from '@/platform/config/index';
import {log} from '@/platform/logger';

export class DataModelFactoryImpl implements IDataModelFactory {
    createDataModel(command: CreateDataModelCommand): DataModel {
        const dataModelId = crypto.randomUUID();
        const ownedBy = command.ownedBy ?? config.system.userId;

        const datasource = new DataSource(
            command.datasourceId,
            '',
            ownedBy,
            new Date(),
            command.createdBy
        );

        const columns: ModelColumn[] = (command.columns || []).map((col) => {
            return new ModelColumn(
                crypto.randomUUID(),
                dataModelId,
                col.name,
                ownedBy,
                new Date(),
                command.createdBy,
                col.description,
                col.feature,
                false,
                new Date(),
                null,
                null,
                null,
                col.displayName,
                col.dataType,
                col.length,
                col.precision,
                col.scale,
                col.isNullable,
                col.defaultValue !== null ? String(col.defaultValue) : null,
                col.orderIndex,
                col.isPrimaryKey
            );
        });

        return new DataModel(
            dataModelId,
            command.name,
            command.status,
            datasource,
            ownedBy,
            new Date(),
            command.createdBy,
            command.description,
            command.tableName,
            columns,
            command.feature,
            false
        );
    }

    updateDataModel(
        dataModel: DataModel,
        command: UpdateDataModelCommand
    ): DataModel {
        if (command.name) {
            dataModel.updateInfo(command.name, command.description || '', dataModel.tableName);
        }

        if (command.tableName) {
            dataModel.tableName = command.tableName;
        }

        if (command.feature) {
            dataModel.updateFeature(command.feature);
        }

        dataModel.updatedBy = command.updatedBy;
        dataModel.updateTime = new Date();

        return dataModel;
    }

    createOrUpdateColumns(
        dataModel: DataModel,
        columns: ModelColumnUpdateCommand[]
    ): ModelColumn[] {
        const now = new Date();
        const result: ModelColumn[] = [];

        for (const col of columns) {
            switch (col.operation) {
                case ColumnOperation.CREATE:
                    // 创建新列（由 Command 明确指定）
                    result.push(new ModelColumn(
                        crypto.randomUUID(),  // 确实需要新 ID
                        dataModel.id,
                        col.name || '',
                        dataModel.ownedBy,
                        new Date(),
                        col.updatedBy || '',  // 确保是 string 类型
                        col.description,
                        undefined,
                        false,
                        now,
                        null,
                        null,
                        null,
                        col.displayName,
                        col.dataType,
                        col.length ?? null,
                        col.precision ?? null,
                        col.scale ?? null,
                        col.isNullable ?? true,
                        col.defaultValue !== null ? String(col.defaultValue) : null,
                        col.orderIndex ?? 0,
                        col.isPrimaryKey ?? false
                    ));
                    break;

                case ColumnOperation.UPDATE:
                    // 更新现有列
                    const existingColumn = dataModel.columns.find(c => c.id === col.columnId);
                    if (!existingColumn) {
                        // 列已被删除或不存在，记录警告并跳过
                        log.warn(`Column with id ${col.columnId} not found for update, skipping. It may have been already deleted.`);
                        break;
                    }
                    existingColumn.update({
                        name: col.name,
                        displayName: col.displayName,
                        dataType: col.dataType,
                        length: col.length ?? null,
                        precision: col.precision ?? null,
                        scale: col.scale ?? null,
                        isNullable: col.isNullable,
                        defaultValue: col.defaultValue !== null ? String(col.defaultValue) : null,
                        description: col.description,
                        orderIndex: col.orderIndex,
                        isPrimaryKey: col.isPrimaryKey
                    });
                    existingColumn.updatedBy = col.updatedBy;
                    result.push(existingColumn);
                    break;

                case ColumnOperation.DELETE:
                    const columnToDelete = dataModel.columns.find(c => c.id === col.columnId);
                    if (columnToDelete) {
                        columnToDelete.isDeleted = true;
                        columnToDelete.deleteTime = new Date();
                        columnToDelete.deletedBy = col.updatedBy || '';
                        result.push(columnToDelete);
                    }
                    break;
            }
        }

        // 标记 DataModel 更新时间
        dataModel.updateTime = now;

        return result;
    }
}

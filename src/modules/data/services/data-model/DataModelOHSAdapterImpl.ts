import {NextRequest} from 'next/server';
import {paginationSchema} from '@/shared/schemas/common/paginationSchema';
import {IDataModelOHSAdapter} from '@/modules/data/services/data-model/IDataModelOHSAdapter';
import type {DataModelDetailVO, DataModelVO, ModelColumnVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {
    ActivateDataModelCommand,
    CreateDataModelCommand,
    DeactivateDataModelCommand,
    DeleteDataModelCommand,
    ModelColumnCreateCommand,
    ModelColumnUpdateCommand,
    UpdateDataModelCommand
} from '@/modules/data/contracts/data-model/commands/index';
import {GetDataModelQuery, ListDataModelsQuery} from '@/modules/data/contracts/data-model/queries/index';
import {DataModelStatus, DataSourceStatus, DataSourceType} from '@/shared/enums/index';
import {DataType} from '@/shared/enums/data-models/DataType';
import type {ModelColumnCreateDTO, ModelColumnUpdateDTO} from '@/modules/data/contracts/schemas/request/data-model/index';
import {createDataModelSchema, updateDataModelSchema, dataModelQuerySchema} from '@/modules/data/contracts/schemas/request/data-model/index';
import {getCurrentUserId} from '@/modules/identity/server';
import {getCurrentTenantId, createTenantFilter} from '@/platform/get-current-tenant';
import {config} from '@/platform/config/index';
import {ColumnOperation} from '@/modules/data/contracts/data-model/commands/ModelColumnUpdateCommand';
import type {FeatureJsonValue} from '@/shared/schemas/common/featureSchema';

function isValidDataModelStatus(value: string | null | undefined): value is DataModelStatus {
    if (!value) return false;
    return Object.values(DataModelStatus).includes(value as DataModelStatus);
}

function safeParseDataModelStatus(value: string | null | undefined): DataModelStatus | undefined {
    if (isValidDataModelStatus(value)) {
        return value;
    }
    return undefined;
}

function isValidDataType(value: string | DataType | undefined): value is DataType {
    if (!value) return false;
    return Object.values(DataType).includes(value as DataType);
}

function safeParseDataType(value: string | DataType | undefined): DataType {
    if (isValidDataType(value)) {
        return value;
    }
    return DataType.STRING;
}

function toModelColumnCreateCommand(dto: ModelColumnCreateDTO): ModelColumnCreateCommand {
    return new ModelColumnCreateCommand(
        dto.name,
        '',
        dto.displayName,
        safeParseDataType(dto.dataType),
        dto.length ?? null,
        dto.precision ?? null,
        dto.scale ?? null,
        dto.isNullable ?? true,
        dto.defaultValue,
        dto.description,
        dto.orderIndex ?? 0,
        dto.isPrimaryKey ?? false,
        dto.feature ?? undefined
    );
}

function toModelColumnUpdateCommand(dto: ModelColumnUpdateDTO): ModelColumnUpdateCommand {
    const operation = dto.operation ?? 
        (dto.columnId ? ColumnOperation.UPDATE : ColumnOperation.CREATE);

    return new ModelColumnUpdateCommand(
        operation as ColumnOperation,
        dto.columnId,
        '',
        undefined,
        dto.name,
        dto.displayName,
        safeParseDataType(dto.dataType),
        dto.length,
        dto.precision,
        dto.scale,
        dto.isNullable,
        dto.defaultValue,
        dto.description,
        dto.orderIndex,
        dto.isPrimaryKey
    );
}

export class DataModelOHSAdapterImpl implements IDataModelOHSAdapter {
    public fromRequestToListDataModelsQuery(request: NextRequest): ListDataModelsQuery {
        const searchParams = request.nextUrl.searchParams;
        const queryParams = {
            page: searchParams.get('page') ?? undefined,
            pageSize: searchParams.get('pageSize') ?? undefined,
            name: searchParams.get('name') ?? undefined,
            status: searchParams.get('status') ?? undefined,
            datasourceId: searchParams.get('datasourceId') ?? undefined
        };

        const validatedParams = dataModelQuerySchema.parse(queryParams);
        const tenantId = getCurrentTenantId(request);

        return {
            page: validatedParams.page,
            pageSize: validatedParams.pageSize,
            name: validatedParams.name,
            status: validatedParams.status,
            datasourceId: validatedParams.datasourceId,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    public fromRequestToGetDataModelQuery(request: NextRequest, id?: string): GetDataModelQuery {
        const searchParams = request.nextUrl.searchParams;
        const tenantId = getCurrentTenantId(request);

        return {
            modelId: id || searchParams.get('id') || '',
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    public async fromRequestToCreateDataModelCommand(request: NextRequest): Promise<CreateDataModelCommand> {
        const body = await request.json();
        const validatedBody = createDataModelSchema.parse(body);
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return new CreateDataModelCommand(
            validatedBody.name,
            userId,
            validatedBody.datasourceId,
            validatedBody.description ?? '',
            validatedBody.tableName ?? '',
            validatedBody.status,
            validatedBody.columns.map(toModelColumnCreateCommand),
            validatedBody.feature ?? undefined,
            getCurrentTenantId(request)
        );
    }

    public async fromRequestToUpdateDataModelCommand(request: NextRequest, id: string): Promise<UpdateDataModelCommand> {
        const body = await request.json();
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        const validatedBody = updateDataModelSchema.parse(body);

        return new UpdateDataModelCommand(
            id,
            validatedBody.name,
            validatedBody.description,
            validatedBody.tableName,
            validatedBody.columns?.map(toModelColumnUpdateCommand),
            validatedBody.feature ?? undefined,
            getCurrentTenantId(request),
            userId
        );
    }

    public fromRequestToDeleteDataModelCommand(request: NextRequest, id: string): DeleteDataModelCommand {
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return new DeleteDataModelCommand(
            id,
            userId,
            getCurrentTenantId(request)
        );
    }

    public fromRequestToActivateDataModelCommand(request: NextRequest, id: string): ActivateDataModelCommand {
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return new ActivateDataModelCommand(
            id,
            userId,
            getCurrentTenantId(request)
        );
    }

    public fromRequestToDeactivateDataModelCommand(request: NextRequest, id: string): DeactivateDataModelCommand {
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return new DeactivateDataModelCommand(
            id,
            userId,
            getCurrentTenantId(request)
        );
    }

    /**
     * 将领域对象转换为详情VO
     * @param dataModel 数据模型领域对象
     * @returns 数据模型详情VO
     */
    public fromDataModelToDataModelDetailVO(dataModel: DataModel): DataModelDetailVO {
        return {
            id: dataModel.id,
            name: dataModel.name,
            description: dataModel.description,
            datasource: {
                id: dataModel.datasource.id,
                name: dataModel.datasource.name,
                type: dataModel.datasource.type || DataSourceType.POSTGRESQL,  // 兜底值
                host: dataModel.datasource.host || '',
                port: dataModel.datasource.port || 0,
                databaseName: dataModel.datasource.databaseName || '',
                username: dataModel.datasource.username || '',
                status: dataModel.datasource.status || DataSourceStatus.ACTIVE,  // 兜底值
                ownedBy: dataModel.datasource.ownedBy,
                isDeleted: dataModel.datasource.isDeleted,
                createTime: dataModel.datasource.createTime ? dataModel.datasource.createTime.toISOString() : new Date(0).toISOString(),
                feature: (dataModel.datasource.feature ?? {}) as unknown as FeatureJsonValue,
                updateTime: dataModel.datasource.updateTime?.toISOString() || undefined,
                deleteTime: dataModel.datasource.deleteTime?.toISOString() || undefined,
                createdBy: dataModel.datasource.createdBy,
                updatedBy: dataModel.datasource.updatedBy,
                deletedBy: dataModel.datasource.deletedBy
            },
            tableName: dataModel.tableName,
            status: dataModel.status,
            columns: dataModel.columns.map(column => this.toColumnResponse(column)),
            feature: (dataModel.feature ?? {}) as unknown as FeatureJsonValue,
            createTime: dataModel.createTime?.toISOString() || new Date().toISOString(),
            updateTime: dataModel.updateTime?.toISOString() || undefined,
            createdBy: dataModel.createdBy,
            updatedBy: dataModel.updatedBy || undefined,
            ownedBy: dataModel.ownedBy,
            isDeleted: dataModel.isDeleted
        };
    }

    /**
     * 将领域对象转换为VO
     * @param dataModel 数据模型领域对象
     * @returns 数据模型VO
     */
    public fromDataModelToDataModelVO(dataModel: DataModel): DataModelVO {
        return {
            id: dataModel.id,
            name: dataModel.name,
            description: dataModel.description,
            datasource: {
                id: dataModel.datasource.id,
                name: dataModel.datasource.name,
                type: dataModel.datasource.type || DataSourceType.POSTGRESQL,
                host: dataModel.datasource.host || '',
                port: dataModel.datasource.port || 0,
                databaseName: dataModel.datasource.databaseName || '',
                username: dataModel.datasource.username || '',
                status: dataModel.datasource.status || DataSourceStatus.ACTIVE,
                ownedBy: dataModel.datasource.ownedBy,
                isDeleted: dataModel.datasource.isDeleted,
                createTime: dataModel.datasource.createTime ? dataModel.datasource.createTime.toISOString() : new Date(0).toISOString(),
                feature: (dataModel.datasource.feature ?? {}) as unknown as FeatureJsonValue,
                updateTime: dataModel.datasource.updateTime?.toISOString() || undefined,
                deleteTime: dataModel.datasource.deleteTime?.toISOString() || undefined,
                createdBy: dataModel.datasource.createdBy,
                updatedBy: dataModel.datasource.updatedBy,
                deletedBy: dataModel.datasource.deletedBy
            },
            tableName: dataModel.tableName,
            status: dataModel.status,
            columns: dataModel.columns.map(column => this.toColumnResponse(column)),
            feature: (dataModel.feature ?? {}) as unknown as FeatureJsonValue,
            createTime: dataModel.createTime ? dataModel.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: dataModel.updateTime?.toISOString() || undefined,
            ownedBy: dataModel.ownedBy,
            isDeleted: dataModel.isDeleted
        };
    }

    /**
     * 将列实体转换为VO
     * @param column 列实体对象
     * @returns 列VO
     */
    public toColumnResponse(column: ModelColumn): ModelColumnVO {
        return {
            id: column.id,
            name: column.name,
            displayName: column.displayName,
            dataType: column.dataType!,
            length: column.length || undefined,
            precision: column.precision || undefined,
            scale: column.scale || undefined,
            isNullable: column.isNullable ?? false,
            defaultValue: column.defaultValue,
            description: column.description,
            orderIndex: column.orderIndex ?? 0,
            isPrimaryKey: column.isPrimaryKey ?? false,
            ownedBy: column.ownedBy,
            feature: (column.feature ?? {}) as unknown as FeatureJsonValue,
            isDeleted: column.isDeleted,
            createTime: column.createTime ? column.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: column.updateTime?.toISOString() || undefined,
            deleteTime: column.deleteTime?.toISOString() || undefined,
            createdBy: column.createdBy,
            updatedBy: column.updatedBy || undefined,
            deletedBy: column.deletedBy || undefined
        };
    }

    /**
     * 批量将领域对象转换为VO
     * @param dataModels 数据模型领域对象列表
     * @returns 数据模型VO列表
     */
    public fromDataModelListToDataModelVOList(dataModels: DataModel[]): DataModelVO[] {
        return dataModels.map(dataModel => this.fromDataModelToDataModelVO(dataModel));
    }
}

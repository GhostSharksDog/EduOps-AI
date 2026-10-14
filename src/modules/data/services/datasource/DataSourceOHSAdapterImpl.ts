import {NextRequest} from 'next/server';
import {paginationSchema} from '@/shared/schemas/common/paginationSchema';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {CreateDataSourceDTO, UpdateDataSourceDTO} from '@/modules/data/contracts/schemas/request/datasource/index';
import {IDataSourceOHSAdapter} from '@/modules/data/services/datasource/IDataSourceOHSAdapter';
import {config} from '@/platform/config/index';
import {getCurrentTenantId, createTenantFilter} from '@/platform/get-current-tenant';
import {getCurrentUserId} from '@/modules/identity/server';
import {DataSourceStatus, DataSourceType} from '@/shared/enums/datasource/index';
import {TestDataSourceConnectionQuery} from '@/modules/data/contracts/datasource/commands/index';
import {
    createDataSourceSchema,
    updateDataSourceSchema
} from '@/modules/data/contracts/schemas/request/datasource/index';
import type {FeatureJsonValue} from '@/shared/schemas/common/featureSchema';

/**
 * 数据源OHS适配器实现
 * @description 负责HTTP请求与领域对象之间的转换
 */
export class DataSourceOHSAdapterImpl implements IDataSourceOHSAdapter {
    /**
     * 将HTTP请求转换为列表查询对象
     * @param request HTTP请求对象
     * @returns ListDataSourcesQuery
     */
    public fromRequestToListDataSourcesQuery(request: NextRequest) {
        const searchParams = request.nextUrl.searchParams;
        
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
        const keyword = searchParams.get('keyword') || undefined;
        
        const validatedPagination = paginationSchema.parse({ page, pageSize });
        const tenantId = getCurrentTenantId(request);

        return {
            page: validatedPagination.page,
            pageSize: validatedPagination.pageSize,
            type: searchParams.get('type') as DataSourceType || undefined,
            status: searchParams.get('status') as DataSourceStatus || undefined,
            keyword,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    /**
     * 将HTTP请求转换为获取单个对象查询
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns GetDataSourceQuery
     */
    public fromRequestToGetDataSourceQuery(request: NextRequest, id: string) {
        const tenantId = getCurrentTenantId(request);
        return {
            id,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    /**
     * 将HTTP请求转换为创建命令
     * @param request HTTP请求对象
     * @returns Promise<CreateDataSourceCommand>
     */
    public async fromRequestToCreateDataSourceCommand(request: NextRequest) {
        const body = await request.json();
        const validatedBody = createDataSourceSchema.parse(body);
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return {
            name: validatedBody.name,
            type: validatedBody.type,
            host: validatedBody.host,
            port: validatedBody.port,
            databaseName: validatedBody.databaseName,
            username: validatedBody.username,
            password: validatedBody.password,
            status: validatedBody.status,
            ownedBy: getCurrentTenantId(request),
            description: validatedBody.description,
            feature: validatedBody.feature,
            createdBy: userId
        };
    }

    /**
     * 将HTTP请求转换为更新命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns Promise<UpdateDataSourceCommand>
     */
    public async fromRequestToUpdateDataSourceCommand(request: NextRequest, id: string) {
        const body = await request.json();
        const validatedBody = updateDataSourceSchema.parse(body);
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        // 处理 port 类型转换，确保类型正确
        const portValue = validatedBody.port;
        const portNumber: number | undefined = portValue === undefined 
            ? undefined 
            : (typeof portValue === 'string' ? parseInt(portValue, 10) : portValue);

        // 处理密码更新逻辑：空字符串表示不修改密码，不传递该字段
        const passwordUpdate = validatedBody.password && validatedBody.password.trim() !== '' 
            ? validatedBody.password 
            : undefined;

        return {
            id,
            name: validatedBody.name,
            host: validatedBody.host,
            port: portNumber,
            databaseName: validatedBody.databaseName,
            username: validatedBody.username,
            password: passwordUpdate,
            status: validatedBody.status as DataSourceStatus | undefined,
            description: validatedBody.description,
            feature: validatedBody.feature,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为删除命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns DeleteDataSourceCommand
     */
    public fromRequestToDeleteDataSourceCommand(request: NextRequest, id: string) {
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return {
            id,
            deletedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为启用命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns EnableDataSourceCommand
     */
    public fromRequestToEnableDataSourceCommand(request: NextRequest, id: string) {
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return {
            id,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为禁用命令
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns DisableDataSourceCommand
     */
    public fromRequestToDisableDataSourceCommand(request: NextRequest, id: string) {
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return {
            id,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为测试连接查询
     * @param request HTTP请求对象
     * @param id 数据源ID
     * @returns Promise<TestDataSourceConnectionQuery>
     */
    public fromRequestToTestDataSourceConnectionQuery(_request: NextRequest, id: string): Promise<TestDataSourceConnectionQuery> {
        return Promise.resolve({
            id: id
        });
    }

    /**
     * 将DataSource实体转换为DataSourceVO
     * @param dataSource DataSource实体
     * @returns DataSourceVO
     */
    fromDataSourceToDataSourceVO(dataSource: DataSource): DataSourceVO {
        return {
            id: dataSource.id,
            name: dataSource.name,
            type: dataSource.type!,
            host: dataSource.host!,
            port: dataSource.port!,
            databaseName: dataSource.databaseName!,
            username: dataSource.username!,
            status: dataSource.status!,
            description: dataSource.description,
            feature: dataSource.feature as unknown as FeatureJsonValue,
            ownedBy: dataSource.ownedBy,
            isDeleted: dataSource.isDeleted,
            createTime: dataSource.createTime ? dataSource.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: dataSource.updateTime ? dataSource.updateTime.toISOString() : undefined,
            deleteTime: dataSource.deleteTime ? dataSource.deleteTime.toISOString() : undefined,
            createdBy: dataSource.createdBy,
            updatedBy: dataSource.updatedBy,
            deletedBy: dataSource.deletedBy
        };
    }

    /**
     * 批量转换DataSource实体为DataSourceVO数组
     * @param dataSources DataSource实体数组
     * @returns DataSourceVO数组
     */
    fromDataSourceListToDataSourceVOList(dataSources: DataSource[]): DataSourceVO[] {
        return dataSources.map(dataSource => this.fromDataSourceToDataSourceVO(dataSource));
    }

    /**
     * 将CreateDataSourceDTO转换为DataSource实体
     * @param dto CreateDataSourceDTO
     * @param tenantId 租户ID（可选）
     * @returns Partial<DataSource> 初始实体数据
     */
    fromDTOToDataSourceEntity(dto: CreateDataSourceDTO, tenantId?: string): Partial<DataSource> {
        return {
            name: dto.name,
            type: dto.type,
            host: dto.host,
            port: dto.port,
            databaseName: dto.databaseName,
            username: dto.username,
            status: dto.status,
            description: dto.description,
            feature: dto.feature,
            ownedBy: tenantId ?? config.system.userId,
            isDeleted: false,
            createTime: new Date(),
            createdBy: tenantId ?? config.system.userId
        };
    }

    /**
     * 将UpdateDataSourceDTO应用到DataSource实体
     * @param dataSource 现有DataSource实体
     * @param dto UpdateDataSourceDTO
     * @returns DataSource 更新后的实体
     */
    fromDTOToUpdateDataSourceEntity(dataSource: DataSource, dto: UpdateDataSourceDTO): DataSource {
        if (dto.name !== undefined) {
            dataSource.name = dto.name;
        }

        if (dto.description !== undefined) {
            dataSource.description = dto.description;
        }

        if (dto.feature !== undefined) {
            dataSource.feature = dto.feature;
        }

        if (dto.host !== undefined) {
            dataSource.host = dto.host;
        }

        if (dto.port !== undefined) {
            dataSource.port = typeof dto.port === 'string' ? parseInt(dto.port, 10) : dto.port;
        }

        if (dto.databaseName !== undefined) {
            dataSource.databaseName = dto.databaseName;
        }

        if (dto.username !== undefined) {
            dataSource.username = dto.username;
        }

        if (dto.password !== undefined) {
            dataSource.password = dto.password;
        }

        if (dto.status !== undefined) {
            dataSource.status = dto.status as DataSourceStatus;
        }

        dataSource.updateTime = new Date();

        return dataSource;
    }
}
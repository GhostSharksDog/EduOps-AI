import {DataSourceAdapter} from '@/modules/data/repositories/DataSourceAdapter';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {DataSourcePO} from '@/modules/data/repositories/persistence/data-source/DataSourcePO';
import {DataSourceStatus, DataSourceType} from '@/shared/enums/datasource/index';

/**
 * 数据源适配器实现
 * 负责DataSource领域实体与DataSourcePO持久化对象之间的双向转换
 */
export class DataSourceAdapterImpl implements DataSourceAdapter {
    /**
     * 将持久化对象转换为领域实体
     * @param dataSourcePO 持久化对象
     * @returns 领域实体
     */
    fromPOToDataSource(dataSourcePO: DataSourcePO): DataSource {
        const feature = typeof dataSourcePO.feature === 'object' && dataSourcePO.feature !== null
            ? dataSourcePO.feature
            : {};

        return new DataSource(
            dataSourcePO.id,
            dataSourcePO.name,
            dataSourcePO.ownedBy,
            dataSourcePO.createTime,
            dataSourcePO.createdBy,
            dataSourcePO.description || undefined,
            dataSourcePO.type as DataSourceType,
            dataSourcePO.host,
            dataSourcePO.port,
            dataSourcePO.databaseName,
            dataSourcePO.username,
            dataSourcePO.password, // password
            dataSourcePO.status as DataSourceStatus,
            dataSourcePO.isDeleted || false,
            feature,
            dataSourcePO.updateTime || undefined,
            dataSourcePO.deleteTime || undefined,
            dataSourcePO.updatedBy || undefined,
            dataSourcePO.deletedBy || undefined
        );
    }

    /**
     * 将领域实体转换为持久化对象
     * @param dataSource 领域实体
     * @returns 持久化对象
     */
    fromDataSourceToPO(dataSource: DataSource): DataSourcePO {
        return {
            id: dataSource.id,
            name: dataSource.name,
            type: dataSource.type as string,
            host: dataSource.host || '',
            port: dataSource.port || 0,
            databaseName: dataSource.databaseName || '',
            username: dataSource.username || '',
            password: dataSource.password ?? '',
            status: dataSource.status as string,
            ownedBy: dataSource.ownedBy,
            description: dataSource.description || null,
            feature: dataSource.feature || null,
            isDeleted: dataSource.isDeleted,
            createTime: dataSource.createTime,
            updateTime: dataSource.updateTime ?? null,
            deleteTime: dataSource.deleteTime ?? null,
            createdBy: dataSource.createdBy,
            updatedBy: dataSource.updatedBy || null,
            deletedBy: dataSource.deletedBy || null
        };
    }
}
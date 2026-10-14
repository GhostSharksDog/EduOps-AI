import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {DataSourcePO} from '@/modules/data/repositories/persistence/data-source/DataSourcePO';

/**
 * 数据源适配器接口
 * 负责DataSource领域实体与DataSourcePO持久化对象之间的双向转换
 */
export interface DataSourceAdapter {
    /**
     * 将持久化对象转换为领域实体
     * @param dataSourcePO 持久化对象
     * @returns 领域实体
     */
    fromPOToDataSource(dataSourcePO: DataSourcePO): DataSource;

    /**
     * 将领域实体转换为持久化对象
     * @param dataSource 领域实体
     * @returns 持久化对象
     */
    fromDataSourceToPO(dataSource: DataSource): DataSourcePO;
}
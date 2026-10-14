/**
 * 数据源类型枚举
 */
export enum DataSourceType {
    /** MySQL数据源 */
    MYSQL = 'MYSQL',
    /** PostgreSQL数据源 */
    POSTGRESQL = 'POSTGRESQL',
    /** ClickHouse数据源 */
    CLICKHOUSE = 'CLICKHOUSE'
}

export const DataSourceTypeLabels: Record<DataSourceType, string> = {
    [DataSourceType.MYSQL]: 'MySQL',
    [DataSourceType.POSTGRESQL]: 'PostgreSQL',
    [DataSourceType.CLICKHOUSE]: 'ClickHouse'
};

export const DataSourceTypeOptions = [
    {value: DataSourceType.MYSQL, label: DataSourceTypeLabels[DataSourceType.MYSQL]},
    {value: DataSourceType.POSTGRESQL, label: DataSourceTypeLabels[DataSourceType.POSTGRESQL]},
    {value: DataSourceType.CLICKHOUSE, label: DataSourceTypeLabels[DataSourceType.CLICKHOUSE]}
];

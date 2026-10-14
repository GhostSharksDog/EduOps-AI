import knex, { Knex } from 'knex';
import { ClickHouse } from 'clickhouse';
import { IDatasourceClientAdapter } from '@/platform/database/interface/IDatasourceClientAdapter';
import {DataSource} from '@/modules/data/server';
import type {TestConnectionEvent} from '@/modules/data/contracts';
import { DataSourceType, TestConnectionResult } from '@/shared/enums/datasource/index';
import {log} from '@/platform/logger';

/**
 * 数据源客户端适配器实现类
 *
 * 架构说明:
 * 1. 实现 IDatasourceClientAdapter 接口
 * * 使用 Knex.js 作为统一的数据库访问层
 * 3. 支持 MySQL、PostgreSQL、ClickHouse 三种数据库类型
 *
 * 技术选型:
 * - Knex.js: 跨数据库的查询构建器
 * - 统一接口适配不同的数据库驱动
 */
export class DatasourceClientAdapterImpl implements IDatasourceClientAdapter {
    /**
     * 测试数据源连接
     *
     * 实现逻辑:
     * 1. 根据数据源类型构建对应的 Knex 配置
     * 2. 建立数据库连接并获取版本信息
     * 3. 构造测试结果事件返回
     *
     * @param dataSource 数据源实体
     * @returns Promise<TestConnectionEvent> 连接测试结果
     */
    async testConnection(dataSource: DataSource): Promise<TestConnectionEvent> {
        const event: TestConnectionEvent = {
            dataSourceId: dataSource.id,
            dataSourceName: dataSource.name,
            dataSourceType: dataSource.type || DataSourceType.POSTGRESQL,
            result: TestConnectionResult.FAILED,
            message: '',
            timestamp: new Date(),
        };

        try {
            let versionInfo: string;

            if (dataSource.type === DataSourceType.CLICKHOUSE) {
                versionInfo = await this.testClickHouseConnection(dataSource);
            } else {
                const knexInstance = knex(this.buildKnexConfig(dataSource));
                try {
                    versionInfo = await this.getDatabaseVersion(knexInstance, dataSource.type);
                } finally {
                    await knexInstance.destroy();
                }
            }

            event.databaseVersion = versionInfo;
            event.result = TestConnectionResult.SUCCESS;
            event.message = `成功连接到 ${this.getDatabaseTypeName(dataSource.type)} 数据库`;

            log.info(`数据源 [${dataSource.name}] 连接测试成功，版本: ${versionInfo}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            event.result = TestConnectionResult.FAILED;
            event.message = `连接失败: ${errorMessage}`;
            event.errorDetails = error instanceof Error ? (error.stack as string) : String(error);

            log.error(`数据源 [${dataSource.name}] 连接测试失败: ${errorMessage}`, error);
        }

        return event;
    }

    private async testClickHouseConnection(dataSource: DataSource): Promise<string> {
        const clickhouse = new ClickHouse({
            host: `http://${dataSource.host}:${dataSource.port}`,
            username: dataSource.username,
            password: dataSource.password,
            database: dataSource.databaseName || 'default',
        });

        const result = await clickhouse.query('SELECT version() as version').toPromise() as { version: string }[];
        return result[0]?.version || 'Unknown';
    }

    /**
     * 构建 Knex 配置
     *
     * @param dataSource 数据源实体
     * @returns Knex 配置对象
     */
    private buildKnexConfig(dataSource: DataSource): Knex.Config {
        const client = this.getKnexClient(dataSource.type);

        return {
            client,
            connection: {
                host: dataSource.host,
                port: dataSource.port,
                user: dataSource.username,
                password: dataSource.password,
                database: dataSource.databaseName,
            },
            pool: {
                min: 2,
                max: 10,
            },
        };
    }

    /**
     * 获取数据库版本信息
     *
     * @param knexInstance Knex 实例
     * @param dataSourceType 数据源类型
     * @returns 数据库版本字符串
     */
    private async getDatabaseVersion(knexInstance: Knex, dataSourceType?: DataSourceType): Promise<string> {
        switch (dataSourceType) {
            case DataSourceType.MYSQL:
                const mysqlVersion = await knexInstance.raw('SELECT VERSION() as version');
                return mysqlVersion[0]?.[0]?.version || 'Unknown';

            case DataSourceType.POSTGRESQL:
            default:
                const pgVersion = await knexInstance.raw('SELECT version()');
                return pgVersion.rows?.[0]?.version || pgVersion[0]?.[0]?.version || 'Unknown';
        }
    }

    /**
     * 获取 Knex 客户端类型
     *
     * @param dataSourceType 数据源类型枚举
     * @returns Knex 客户端类型字符串
     */
    private getKnexClient(dataSourceType?: DataSourceType): 'mysql2' | 'pg' {
        switch (dataSourceType) {
            case DataSourceType.MYSQL:
                return 'mysql2';
            case DataSourceType.POSTGRESQL:
            default:
                return 'pg';
        }
    }

    /**
     * 获取数据库类型名称
     *
     * @param dataSourceType 数据源类型枚举
     * @returns 数据库类型显示名称
     */
    private getDatabaseTypeName(dataSourceType?: DataSourceType): string {
        switch (dataSourceType) {
            case DataSourceType.MYSQL:
                return 'MySQL';
            case DataSourceType.CLICKHOUSE:
                return 'ClickHouse';
            case DataSourceType.POSTGRESQL:
            default:
                return 'PostgreSQL';
        }
    }
}

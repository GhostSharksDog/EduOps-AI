import {DataSource} from '@/modules/data/server';
import type {TestConnectionEvent} from '@/modules/data/contracts';

/**
 * 数据源客户端适配器接口
 *
 * 架构说明:
 * 1. 定义数据源客户端操作的抽象接口
 * 2. 屏蔽底层数据库访问细节
 * 3. 支持多种数据库类型的统一访问
 *
 * 实现约束:
 * - 具体实现类需处理各数据库驱动的差异
 * - 需实现连接池管理和错误处理
 */
export interface IDatasourceClientAdapter {
    /**
     * 测试数据源连接
     *
     * 功能说明:
     * 1. 验证数据源的连接配置是否正确
     * 2. 支持 MySQL、PostgreSQL、ClickHouse 等数据库类型
     * 3. 返回详细的连接测试结果
     *
     * @param dataSource 数据源实体（包含连接配置信息）
     * @returns Promise<TestConnectionEvent> 连接测试结果事件
     *
     * @throws Error 连接测试过程中发生异常
     */
    testConnection(dataSource: DataSource): Promise<TestConnectionEvent>;
}


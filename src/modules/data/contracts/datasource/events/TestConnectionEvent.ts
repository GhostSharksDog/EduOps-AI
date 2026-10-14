import { DataSourceType, TestConnectionResult } from '@/shared/enums/datasource/index';

/**
 * 数据源连接测试事件
 *
 * 领域事件：用于通知数据源连接测试的结果
 *
 * 架构说明:
 * 1. 作为领域事件，记录连接测试的结果信息
 * 2. 可用于事件驱动架构中的通知机制
 * 3. 包含详细的连接状态、数据库版本和错误信息
 */
export interface TestConnectionEvent {
    /** 数据源ID */
    dataSourceId: string;
    /** 数据源名称 */
    dataSourceName: string;
    /** 数据源类型 */
    dataSourceType: DataSourceType;
    /** 测试结果 */
    result: TestConnectionResult;
    /** 连接消息 */
    message: string;
    /** 数据库版本（连接成功时返回） */
    databaseVersion?: string;
    /** 错误详情（连接失败时返回） */
    errorDetails?: string;
    /** 测试时间戳 */
    timestamp: Date;
}

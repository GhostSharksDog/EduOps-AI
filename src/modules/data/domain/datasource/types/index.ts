import {Feature} from "@/shared/types/feature";

/**
 * 数据源连接测试结果
 */
export interface ConnectionTestResult {
    success: boolean;
    message: string;
    error?: string;
    responseTime: number;
}

/**
 * 数据源搜索条件
 */
export interface DataSourceSearchCriteria {
    keyword?: string;
    type?: string;
    status?: string;
    ownedBy?: string;
}

/**
 * 数据源统计条件
 */
export interface DataSourceCountCriteria {
    type?: string;
    status?: string;
    ownedBy?: string;
}

/**
 * 数据源连接信息
 */
export interface DataSourceConnectionInfo {
    host: string;
    port: number;
    databaseName: string;
    username: string;
    password: string;
    type: string;
    feature?: Feature;
}

/**
 * 分页查询参数
 */
export interface PaginationQuery {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
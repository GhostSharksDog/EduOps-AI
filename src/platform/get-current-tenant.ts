import { config } from '@/platform/config/index';
import type { NextRequest } from 'next/server';
export type TenantFilter=Record<string,unknown>;

export interface TenantFilterOptions {
    tenantId?: string;
}

export function createTenantFilter(tenantId?: string): TenantFilterOptions {
    if (!tenantId || tenantId === config.system.userId) {
        return {};
    }
    return { tenantId };
}

export function applyTenantFilterToWhere<T extends Record<string, unknown>>(
    where: T,
    options?: TenantFilterOptions
): T {
    if (!options?.tenantId) {
        return where;
    }
    return {
        ...where,
        OR: [
            { ownedBy: options.tenantId },
            { ownedBy: config.system.userId }
        ]
    } as T;
}

/**
 * 获取当前请求的租户 ID
 * @param request - Next.js Request 对象
 * @returns 租户 ID，未登录时返回系统用户 ID
 */
export function getCurrentTenantId(request: Request | NextRequest): string {
    const tenantId = request.headers.get('x-tenant-id');
    return tenantId || config.system.userId;
}

/**
 * 构建历史业务的机构过滤条件
 * 兼容历史数据：系统用户创建的数据对所有租户可见
 * @param request - Next.js Request 对象
 * @returns 机构过滤条件
 */
export function getTenantFilter(request: Request | NextRequest): Record<string, unknown> {
    const tenantId = getCurrentTenantId(request);
    
    if (tenantId === config.system.userId) {
        return {};
    }
    
    return {
        OR: [
            { ownedBy: tenantId },
            { ownedBy: config.system.userId }
        ]
    };
}

/**
 * 检查是否启用了多租户隔离
 * @param request - Next.js Request 对象
 * @returns true 表示启用了租户隔离
 */
export function isTenantIsolationEnabled(request: Request | NextRequest): boolean {
    const tenantId = request.headers.get('x-tenant-id');
    return !!tenantId && tenantId !== config.system.userId;
}

/**
 * 验证实体所有权 - 用于写操作前的权限检查
 * @param entityOwnedBy - 实体的 ownedBy 字段值
 * @param tenantFilter - 租户过滤选项
 * @returns true 表示验证通过，false 表示无权操作
 */
export function verifyOwnership(entityOwnedBy: string, tenantFilter?: TenantFilterOptions): boolean {
    // 如果没有租户过滤（系统用户），允许所有操作
    if (!tenantFilter?.tenantId) {
        return true;
    }
    
    // 检查实体是否属于当前租户或系统用户
    return entityOwnedBy === tenantFilter.tenantId || entityOwnedBy === config.system.userId;
}

/**
 * 创建所有权验证错误
 * @param entityType - 实体类型名称
 * @param id - 实体ID
 * @returns Error 对象
 */
export function createOwnershipError(entityType: string, id: string): Error {
    return new Error(`${entityType} not found or access denied: ${id}`);
}

import type { NextRequest } from 'next/server';
import {requireCompanyContext} from './company/context';
export type TenantFilter=Record<string,unknown>;

export interface TenantFilterOptions {
    tenantId?: string;
}

export function createTenantFilter(tenantId?: string): TenantFilterOptions {
    const company=requireCompanyContext().company;
    if(tenantId&&tenantId!==company.organizationId)throw new Error('机构与当前公司不一致');
    return { tenantId:company.organizationId };
}

export function applyTenantFilterToWhere<T extends Record<string, unknown>>(
    where: T,
    options?: TenantFilterOptions
): T {
    const tenant=createTenantFilter(options?.tenantId);
    return {
        ...where,
        ownedBy:tenant.tenantId,
    } as T;
}

/**
 * 获取当前请求的租户 ID
 * @param request - Next.js Request 对象
 * @returns 已验证公司编号，缺少上下文时拒绝
 */
export function getCurrentTenantId(_request: Request | NextRequest): string {
    return requireCompanyContext().company.organizationId;
}

/**
 * 构建历史业务的机构过滤条件
 * 原公司历史记录仍在原公司数据库；没有跨公司系统目录。
 * @param request - Next.js Request 对象
 * @returns 机构过滤条件
 */
export function getTenantFilter(request: Request | NextRequest): Record<string, unknown> {
    const tenantId = getCurrentTenantId(request);
    
    return {ownedBy:tenantId};
}

/**
 * 检查是否启用了多租户隔离
 * @param request - Next.js Request 对象
 * @returns true 表示启用了租户隔离
 */
export function isTenantIsolationEnabled(_request: Request | NextRequest): boolean {
    requireCompanyContext();return true;
}

/**
 * 验证实体所有权 - 用于写操作前的权限检查
 * @param entityOwnedBy - 实体的 ownedBy 字段值
 * @param tenantFilter - 租户过滤选项
 * @returns true 表示验证通过，false 表示无权操作
 */
export function verifyOwnership(entityOwnedBy: string, tenantFilter?: TenantFilterOptions): boolean {
    const company=requireCompanyContext().company;
    if(tenantFilter?.tenantId&&tenantFilter.tenantId!==company.organizationId)return false;
    return entityOwnedBy===company.organizationId;
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

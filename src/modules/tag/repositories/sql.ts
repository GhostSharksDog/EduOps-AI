import {queryRows, queryOne, type DbClient} from '@/platform/database';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';

/** 将数据库列映射为现有持久化对象，保留少量历史字段名称。 */
export function mapTagRow<T>(row: Record<string, unknown>, kind?: 'tag' | 'version'): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const name = (key === 'value_type' && kind === 'version') || (key === 'update_cycle' && kind === 'tag')
      ? key : key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
    return [name, value];
  })) as T;
}
export async function tagRows<T>(sql: string, params: unknown[] = [], client?: DbClient, kind?: 'tag' | 'version'): Promise<T[]> {
  return (await queryRows<Record<string, unknown>>(sql, params, client)).map(row => mapTagRow<T>(row, kind));
}
export async function tagOne<T>(sql: string, params: unknown[] = [], client?: DbClient, kind?: 'tag' | 'version'): Promise<T | null> {
  const row = await queryOne<Record<string, unknown>>(sql, params, client);
  return row ? mapTagRow<T>(row, kind) : null;
}
export function ownershipSql(params: unknown[], tenant?: TenantFilterOptions, prefix = ''): string {
  if (!tenant?.tenantId) return '';
  params.push(tenant.tenantId);
  return ` AND ${prefix}owned_by=$${params.length}::uuid`;
}
export const jsonParam = (value: unknown): string | null => value == null ? null : JSON.stringify(value);

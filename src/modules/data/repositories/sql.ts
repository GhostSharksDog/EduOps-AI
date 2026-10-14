import { db, mapRow, queryRows, queryOne, type DbClient } from '@/platform/database';
import { config } from '@/platform/config';
import type { TenantFilterOptions } from '@/platform/get-current-tenant';
type DataTable = 'data_sources' | 'data_model' | 'model_column';
const snake = (name: string) => name.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const value = (key: string, input: unknown) => key === 'feature' && input !== null ? JSON.stringify(input) : input;
export async function dataRows<T>(sql: string, params: unknown[] = [], client: DbClient = db): Promise<T[]> { return (await queryRows<Record<string, unknown>>(sql, params, client)).map(row => mapRow<T>(row)); }
export async function dataOne<T>(sql: string, params: unknown[] = [], client: DbClient = db): Promise<T | null> { const row = await queryOne<Record<string, unknown>>(sql, params, client); return row ? mapRow<T>(row) : null; }
export async function insertDataRow<T>(table: DataTable, row: object, client: DbClient = db): Promise<T> { const entries = Object.entries(row).filter(([, v]) => v !== undefined); const result = await dataOne<T>(`INSERT INTO ${table} (${entries.map(([key]) => '"' + snake(key) + '"').join(',')}) VALUES (${entries.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, entries.map(([key, v]) => value(key, v)), client); if (!result)
    throw new Error('保存记录失败'); return result; }
export async function updateDataRow<T>(table: DataTable, id: string, row: object, client: DbClient = db): Promise<T> { const entries = Object.entries(row).filter(([key, v]) => key !== 'id' && v !== undefined); const result = await dataOne<T>(`UPDATE ${table} SET ${entries.map(([key], i) => '"' + snake(key) + '"=$' + (i + 1)).join(',')} WHERE id=$${entries.length + 1} RETURNING *`, [...entries.map(([key, v]) => value(key, v)), id], client); if (!result)
    throw new Error('记录不存在'); return result; }
export function addDataOwnership(parts: string[], values: unknown[], filter?: TenantFilterOptions) { if (filter?.tenantId) {
    values.push(filter.tenantId, config.system.userId);
    parts.push(`owned_by IN ($${values.length - 1},$${values.length})`);
} }
export function dataPagination(parts: string[], values: unknown[], take?: number, skip?: number) { if (take !== undefined) {
    values.push(take);
    parts.push('LIMIT $' + values.length);
} if (skip !== undefined) {
    values.push(skip);
    parts.push('OFFSET $' + values.length);
} }

import { db, mapRow, queryRows, queryOne, type DbClient } from '@/platform/database';
import type { TenantFilterOptions } from '@/platform/get-current-tenant';
type SegmentTable = 'segment' | 'segment_condition' | 'segment_member' | 'segment_calculation_task';
const snake = (name: string) => name.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const jsonKeys = new Set(['feature', 'scheduleConfig', 'fieldValue']);
const value = (key: string, input: unknown) => jsonKeys.has(key) && input !== null ? JSON.stringify(input) : input;
export async function segmentRows<T>(sql: string, params: unknown[] = [], client: DbClient = db): Promise<T[]> { return (await queryRows<Record<string, unknown>>(sql, params, client)).map(row => mapRow<T>(row)); }
export async function segmentOne<T>(sql: string, params: unknown[] = [], client: DbClient = db): Promise<T | null> { const row = await queryOne<Record<string, unknown>>(sql, params, client); return row ? mapRow<T>(row) : null; }
export async function insertSegmentRow<T>(table: SegmentTable, row: object, client: DbClient = db): Promise<T> { const entries = Object.entries(row).filter(([, v]) => v !== undefined); const result = await segmentOne<T>(`INSERT INTO ${table} (${entries.map(([key]) => '"' + snake(key) + '"').join(',')}) VALUES (${entries.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, entries.map(([key, v]) => value(key, v)), client); if (!result)
    throw new Error('保存记录失败'); return result; }
export async function updateSegmentRow<T>(table: SegmentTable, id: string, row: object, client: DbClient = db): Promise<T> { const entries = Object.entries(row).filter(([key, v]) => key !== 'id' && v !== undefined); const result = await segmentOne<T>(`UPDATE ${table} SET ${entries.map(([key], i) => '"' + snake(key) + '"=$' + (i + 1)).join(',')} WHERE id=$${entries.length + 1} RETURNING *`, [...entries.map(([key, v]) => value(key, v)), id], client); if (!result)
    throw new Error('记录不存在'); return result; }
export function addSegmentOwnership(parts: string[], values: unknown[], filter?: TenantFilterOptions) { if (filter?.tenantId) {
    values.push(filter.tenantId);
    parts.push(`owned_by=$${values.length}`);
} }

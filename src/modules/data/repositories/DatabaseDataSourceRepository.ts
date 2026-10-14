import type { DataSourceRepository } from '../domain/ports/DataSourceRepository';
import type { DataSource } from '../domain/datasource/entities/DataSource';
import type { DataSourceAdapter } from './DataSourceAdapter';
import { transaction } from '@/platform/database';
import { verifyOwnership, createOwnershipError, type TenantFilterOptions } from '@/platform/get-current-tenant';
import type { DataSourceRow } from './row-types';
import { dataOne, dataRows, insertDataRow, updateDataRow, addDataOwnership, dataPagination } from './sql';
type Filter = {
    skip?: number;
    take?: number;
    type?: string;
    status?: string;
    ownedBy?: string;
    name?: string;
    tenantFilter?: TenantFilterOptions;
};
function predicate(filter: Filter = {}) { const parts = ['is_deleted=false'], values: unknown[] = []; for (const key of ['type', 'status', 'ownedBy'] as const)
    if (filter[key]) {
        values.push(filter[key]);
        parts.push(`${key === 'ownedBy' ? 'owned_by' : key}=$${values.length}`);
    } if (filter.name) {
    values.push('%' + filter.name + '%');
    parts.push('name ILIKE $' + values.length);
} addDataOwnership(parts, values, filter.tenantFilter); return { parts, values }; }
export class DatabaseDataSourceRepository implements DataSourceRepository {
    constructor(private readonly dataSourceAdapter: DataSourceAdapter) { }
    async save(source: DataSource, filter?: TenantFilterOptions): Promise<DataSource> { const po = this.dataSourceAdapter.fromDataSourceToPO(source); const row = await transaction(async (tx) => { await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [po.id]); const existing = await dataOne<DataSourceRow>('SELECT * FROM data_sources WHERE id=$1 FOR UPDATE', [po.id], tx); if (existing && !verifyOwnership(existing.ownedBy, filter))
        throw createOwnershipError('DataSource', po.id); if (!existing)
        return insertDataRow<DataSourceRow>('data_sources', { ...po, createTime: po.createTime ?? new Date(), isDeleted: po.isDeleted ?? false }, tx); return updateDataRow<DataSourceRow>('data_sources', po.id, { name: po.name, type: po.type, host: po.host, port: po.port, databaseName: po.databaseName, username: po.username, ...(po.password ? { password: po.password } : {}), status: po.status, description: po.description, feature: po.feature ?? undefined, updateTime: new Date(), updatedBy: po.updatedBy, isDeleted: po.isDeleted, deleteTime: po.isDeleted ? new Date() : null, deletedBy: po.isDeleted ? po.updatedBy : null }, tx); }); return this.dataSourceAdapter.fromPOToDataSource(row); }
    async findById(id: string, filter?: TenantFilterOptions) { const parts = ['id=$1', 'is_deleted=false'], values: unknown[] = [id]; addDataOwnership(parts, values, filter); const row = await dataOne<DataSourceRow>('SELECT * FROM data_sources WHERE ' + parts.join(' AND '), values); return row ? this.dataSourceAdapter.fromPOToDataSource(row) : null; }
    async findByName(name: string, filter?: TenantFilterOptions) { const parts = ['name=$1', 'is_deleted=false'], values: unknown[] = [name]; addDataOwnership(parts, values, filter); const row = await dataOne<DataSourceRow>('SELECT * FROM data_sources WHERE ' + parts.join(' AND '), values); return row ? this.dataSourceAdapter.fromPOToDataSource(row) : null; }
    async findAll(filter?: Filter) { const { parts, values } = predicate(filter), tail = ['ORDER BY create_time DESC']; dataPagination(tail, values, filter?.take, filter?.skip); return (await dataRows<DataSourceRow>('SELECT * FROM data_sources WHERE ' + parts.join(' AND ') + ' ' + tail.join(' '), values)).map(row => this.dataSourceAdapter.fromPOToDataSource(row)); }
    async count(filter?: Filter) { const { parts, values } = predicate(filter); return Number((await dataOne<{
        count: string;
    }>('SELECT count(*) AS count FROM data_sources WHERE ' + parts.join(' AND '), values))?.count ?? 0); }
    async delete(_id: string): Promise<void> { throw new Error('请使用 save 方法进行软删除操作'); }
}

import type { DataModelRepository } from '../domain/ports/DataModelRepository';
import { DataModel } from '../domain/data-model/entities/DataModel';
import type { DataModelQueryParams } from '../contracts/data-model/queries';
import { DataModelAdapterImpl, ModelColumnAdapterImpl } from './DataModelAdapterImpl';
import { transaction, db, type DbClient } from '@/platform/database';
import { verifyOwnership, createOwnershipError, type TenantFilterOptions } from '@/platform/get-current-tenant';
import type { DataModelRow, DataSourceRow, ModelColumnRow } from './row-types';
import { dataOne, dataRows, insertDataRow, updateDataRow, addDataOwnership, dataPagination } from './sql';
type Query = DataModelQueryParams & {
    tenantFilter?: TenantFilterOptions;
};
function predicate(query: Query = {}) { const parts = ['is_deleted=false'], values: unknown[] = []; for (const key of ['status', 'datasourceId'] as const)
    if (query[key]) {
        values.push(query[key]);
        parts.push(`${key === 'datasourceId' ? 'datasource_id' : key}=$${values.length}`);
    } if (query.name) {
    values.push('%' + query.name + '%');
    parts.push('name LIKE $' + values.length);
} addDataOwnership(parts, values, query.tenantFilter); return { parts, values }; }
export class DatabaseDataModelRepository implements DataModelRepository {
    private readonly columnAdapter = new ModelColumnAdapterImpl();
    private readonly adapter = new DataModelAdapterImpl(this.columnAdapter);
    private async hydrate(row: DataModelRow, client: DbClient = db, includeDeleted = false) { row.dataSource = (await dataOne<DataSourceRow>('SELECT * FROM data_sources WHERE id=$1', [row.datasourceId], client)) ?? undefined; const columns = await dataRows<ModelColumnRow>('SELECT * FROM model_column WHERE model_id=$1' + (includeDeleted ? '' : ' AND is_deleted=false') + ' ORDER BY order_index', [row.id], client); return this.adapter.fromDataModelPOToDataModel(row, columns); }
    async create(model: DataModel): Promise<DataModel> { return transaction(async (tx) => { const po = this.adapter.fromDataModelToDataModelPO(model); const row = await insertDataRow<DataModelRow>('data_model', { ...po, createTime: po.createTime ?? new Date(), updateTime: po.updateTime ?? new Date(), feature: po.feature ?? {} }, tx); for (const column of model.columns) {
        const c = this.columnAdapter.fromModelColumnToModelColumnPO(column);
        await insertDataRow<ModelColumnRow>('model_column', { ...c, modelId: row.id, createTime: c.createTime ?? new Date(), feature: c.feature ?? {} }, tx);
    } return this.hydrate(row, tx); }); }
    private async find(idOrName: string, byName: boolean, filter?: TenantFilterOptions, includeDeleted = false) { const parts = [(byName ? 'name' : 'id') + '=$1', 'is_deleted=false'], values: unknown[] = [idOrName]; addDataOwnership(parts, values, filter); const row = await dataOne<DataModelRow>('SELECT * FROM data_model WHERE ' + parts.join(' AND '), values); return row ? this.hydrate(row, db, includeDeleted) : null; }
    findById(id: string, filter?: TenantFilterOptions) { return this.find(id, false, filter); }
    findByIdForUpdate(id: string, filter?: TenantFilterOptions) { return this.find(id, false, filter, true); }
    findByName(name: string, filter?: TenantFilterOptions) { return this.find(name, true, filter); }
    async findAll(query?: Query) { const { parts, values } = predicate(query), tail = ['ORDER BY create_time DESC']; dataPagination(tail, values, query?.pageSize, query?.page && query?.pageSize ? (query.page - 1) * query.pageSize : undefined); const rows = await dataRows<DataModelRow>('SELECT * FROM data_model WHERE ' + parts.join(' AND ') + ' ' + tail.join(' '), values); return Promise.all(rows.map(row => this.hydrate(row))); }
    async update(model: DataModel, filter?: TenantFilterOptions): Promise<DataModel> {
        return transaction(async (tx) => {
            const existing = await dataOne<DataModelRow>('SELECT * FROM data_model WHERE id=$1 FOR UPDATE', [model.id], tx);
            if (!existing || !verifyOwnership(existing.ownedBy, filter))
                throw createOwnershipError('DataModel', model.id);
            const po = this.adapter.fromDataModelToDataModelPO(model);
            const row = await updateDataRow<DataModelRow>('data_model', po.id, { name: po.name, description: po.description, tableName: po.tableName, status: po.status, datasourceId: po.datasourceId, feature: po.feature ?? {}, isDeleted: po.isDeleted, deleteTime: po.deleteTime, deletedBy: po.deletedBy, updateTime: new Date(), updatedBy: po.updatedBy }, tx);
            const existingColumns = await dataRows<ModelColumnRow>('SELECT * FROM model_column WHERE model_id=$1 FOR UPDATE', [model.id], tx), existingIds = new Set(existingColumns.map(c => c.id)), active = model.columns.filter(c => !c.isDeleted), activeIds = active.map(c => c.id);
            await tx.query('UPDATE model_column SET is_deleted=true,delete_time=now(),deleted_by=$3 WHERE model_id=$1 AND NOT is_deleted AND NOT(id=ANY($2::uuid[]))', [model.id, activeIds, po.updatedBy]);
            for (const column of active) {
                const c = this.columnAdapter.fromModelColumnToModelColumnPO(column);
                if (existingIds.has(c.id))
                    await updateDataRow<ModelColumnRow>('model_column', c.id, { name: c.name, displayName: c.displayName, dataType: c.dataType, length: c.length, precision: c.precision, scale: c.scale, isNullable: c.isNullable, defaultValue: c.defaultValue, description: c.description, orderIndex: c.orderIndex, isPrimaryKey: c.isPrimaryKey, feature: c.feature ?? {}, isDeleted: false, deleteTime: null, deletedBy: null, updateTime: new Date(), updatedBy: c.updatedBy }, tx);
                else {
                    const conflicting = await dataOne<ModelColumnRow>('SELECT * FROM model_column WHERE id=$1', [c.id], tx);
                    if (conflicting)
                        throw createOwnershipError('ModelColumn', c.id);
                    await insertDataRow<ModelColumnRow>('model_column', { ...c, modelId: model.id, ownedBy: row.ownedBy, feature: c.feature ?? {}, isDeleted: false, deleteTime: null, deletedBy: null, createTime: c.createTime ?? new Date() }, tx);
                }
            }
            return this.hydrate(row, tx);
        });
    }
    async count(query?: Query) { const { parts, values } = predicate(query); return Number((await dataOne<{
        count: string;
    }>('SELECT count(*) AS count FROM data_model WHERE ' + parts.join(' AND '), values))?.count ?? 0); }
    async delete(_id: string): Promise<void> { throw new Error('请使用 update 方法进行软删除操作'); }
}

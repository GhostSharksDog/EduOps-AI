import type { Page, SegmentRepository } from '../domain/ports/SegmentRepository';
import type { SegmentFilter } from '../domain/commands/SegmentFilter';
import type { Segment } from '../domain/entities/Segment';
import type { SegmentStatus } from '@/shared/enums';
import { transaction, db, type DbClient } from '@/platform/database';
import { randomUUID } from 'node:crypto';
import { SegmentAdapterImpl } from './SegmentAdapterImpl';
import type { SegmentConditionGroup } from '../domain/value-objects/SegmentConditionGroup';
import type { SegmentCondition } from '../domain/value-objects/SegmentCondition';
import { verifyOwnership, createOwnershipError, type TenantFilterOptions } from '@/platform/get-current-tenant';
import type { SegmentRow, SegmentConditionRow } from './row-types';
import { segmentRows, segmentOne, insertSegmentRow, updateSegmentRow, addSegmentOwnership } from './sql';
export class DatabaseSegmentRepository implements SegmentRepository {
    private readonly adapter = new SegmentAdapterImpl();
    async save(segment: Segment): Promise<void> {
        const po = this.adapter.fromSegmentToPO(segment);
        await transaction(async (tx) => {
            await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [segment.id]);
            const existing = await segmentOne<SegmentRow>('SELECT * FROM segment WHERE id=$1 FOR UPDATE', [segment.id], tx);
            if (existing && existing.ownedBy !== segment.ownedBy)
                throw createOwnershipError('Segment', segment.id);
            if (existing)
                await updateSegmentRow<SegmentRow>('segment', po.id, { name: po.name, description: po.description, entityType: po.entityType, computeType: po.computeType, status: po.status, scheduleConfig: po.scheduleConfig, lastCalculationTime: po.lastCalculationTime, feature: po.feature ?? undefined, updateTime: new Date(), updatedBy: po.updatedBy }, tx);
            else
                await insertSegmentRow<SegmentRow>('segment', { ...po, isDeleted: false, createTime: po.createTime ?? new Date(), updateTime: po.updateTime ?? new Date() }, tx);
            // 同事务替换条件树，使用延迟删除子节点避免自关联外键影响。
            await tx.query('UPDATE segment_condition SET parent_id=NULL WHERE segment_id=$1', [segment.id]);
            await tx.query('DELETE FROM segment_condition WHERE segment_id=$1', [segment.id]);
            if (segment.conditionGroup)
                await this.createConditions(tx, segment.id, segment.conditionGroup, null, segment.ownedBy, segment.createdBy);
        });
    }
    async remove(id: string, filter?: TenantFilterOptions): Promise<void> { await transaction(async (tx) => { const existing = await segmentOne<SegmentRow>('SELECT * FROM segment WHERE id=$1 FOR UPDATE', [id], tx); if (!existing || !verifyOwnership(existing.ownedBy, filter))
        throw createOwnershipError('Segment', id); for (const table of ['segment', 'segment_condition', 'segment_calculation_task','segment_member'] as const)
        await tx.query(`UPDATE ${table} SET is_deleted=true,delete_time=now() WHERE ${table === 'segment' ? 'id' : 'segment_id'}=$1 AND NOT is_deleted`, [id]); }); }
    private async hydrate(rows: SegmentRow[], client: DbClient = db): Promise<Segment[]> { if (!rows.length)
        return []; const conditions = await segmentRows<SegmentConditionRow>('SELECT * FROM segment_condition WHERE segment_id=ANY($1::uuid[]) AND is_deleted=false', [rows.map(row => row.id)], client); return rows.map(row => this.adapter.fromPOToSegment(row, conditions.filter(c => c.segmentId === row.id))); }
    private async find(value: string, byName: boolean, filter?: TenantFilterOptions) { const parts = [(byName ? 'name' : 'id') + '=$1', 'is_deleted=false'], values: unknown[] = [value]; addSegmentOwnership(parts, values, filter); const rows = await segmentRows<SegmentRow>('SELECT * FROM segment WHERE ' + parts.join(' AND '), values); return (await this.hydrate(rows))[0] ?? null; }
    findById(id: string, filter?: TenantFilterOptions) { return this.find(id, false, filter); }
    findByName(name: string, filter?: TenantFilterOptions) { return this.find(name, true, filter); }
    async findByStatus(status: SegmentStatus) { return this.hydrate(await segmentRows<SegmentRow>('SELECT * FROM segment WHERE status=$1 AND is_deleted=false ORDER BY update_time DESC', [status])); }
    async findAll(filter: SegmentFilter): Promise<Page<Segment>> { const parts = ['is_deleted=false'], values: unknown[] = []; for (const [column, value] of [['status', filter.status], ['entity_type', filter.type], ['owned_by', filter.ownedBy]])
        if (value) {
            values.push(value);
            parts.push(column + '=$' + values.length);
        } if (filter.name) {
        values.push('%' + filter.name + '%');
        parts.push('name LIKE $' + values.length);
    } addSegmentOwnership(parts, values, filter.tenantFilter); const page = filter.pagination?.page ?? 1, pageSize = filter.pagination?.pageSize ?? 10, where = parts.join(' AND '); const [count, rows] = await Promise.all([segmentOne<{
            count: string;
        }>('SELECT count(*) AS count FROM segment WHERE ' + where, values), segmentRows<SegmentRow>(`SELECT * FROM segment WHERE ${where} ORDER BY update_time DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, (page - 1) * pageSize])]); return { total: Number(count?.count ?? 0), items: await this.hydrate(rows), page, pageSize }; }
    private async createConditions(tx: DbClient, segmentId: string, group: SegmentConditionGroup, parentId: string | null, ownedBy: string, createdBy: string) { const id = randomUUID(), now = new Date(); await insertSegmentRow<SegmentConditionRow>('segment_condition', { id, segmentId, parentId, conditionType: 'GROUP', operator: group.operator, ownedBy, feature: {}, isDeleted: false, createTime: now, updateTime: now, createdBy }, tx); for (const condition of group.conditions)
        if ('conditions' in condition)
            await this.createConditions(tx, segmentId, condition as SegmentConditionGroup, id, ownedBy, createdBy);
        else {
            const leaf = condition as SegmentCondition;
            await insertSegmentRow<SegmentConditionRow>('segment_condition', { id: randomUUID(), segmentId, parentId: id, conditionType: 'TAG', operator: leaf.operator, fieldName: leaf.tagId, fieldValue: leaf.value, ownedBy, feature: {}, isDeleted: false, createTime: now, updateTime: now, createdBy }, tx);
        } }
}

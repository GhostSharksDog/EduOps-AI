import type { Page, SegmentCalculationTaskRepository, TaskQuery } from '../domain/ports/SegmentCalculationTaskRepository';
import type { SegmentCalculationTask, TaskId } from '../domain/entities/SegmentCalculationTask';
import { SegmentCalculationTaskAdapterImpl } from './SegmentCalculationTaskAdapterImpl';
import { transaction } from '@/platform/database';
import { createOwnershipError } from '@/platform/get-current-tenant';
import type { SegmentTaskRow, SegmentRow } from './row-types';
import { segmentRows, segmentOne, insertSegmentRow, updateSegmentRow } from './sql';
export class DatabaseSegmentCalculationTaskRepository implements SegmentCalculationTaskRepository {
    private readonly adapter = new SegmentCalculationTaskAdapterImpl();
    async save(task: SegmentCalculationTask): Promise<void> { const po = this.adapter.fromSegmentCalculationTaskToPO(task); await transaction(async (tx) => { await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [task.id]); const segment = await segmentOne<SegmentRow>('SELECT * FROM segment WHERE id=$1 AND owned_by=$2 AND is_deleted=false FOR SHARE', [po.segmentId, po.ownedBy], tx); if (!segment)
        throw createOwnershipError('Segment', po.segmentId); const old = await segmentOne<SegmentTaskRow>('SELECT * FROM segment_calculation_task WHERE id=$1 FOR UPDATE', [task.id], tx); if (old && (old.ownedBy !== po.ownedBy || old.segmentId !== po.segmentId))
        throw createOwnershipError('SegmentCalculationTask', task.id); if (old)
        await updateSegmentRow<SegmentTaskRow>('segment_calculation_task', task.id, { name: po.name, description: po.description, startTime: po.startTime, endTime: po.endTime, status: po.status, resultCount: po.resultCount, errorMessage: po.errorMessage, feature: po.feature ?? undefined, updateTime: new Date(), updatedBy: po.updatedBy }, tx);
    else
        await insertSegmentRow<SegmentTaskRow>('segment_calculation_task', { ...po, isDeleted: false, createTime: po.createTime ?? new Date(), updateTime: po.updateTime ?? new Date() }, tx); }); }
    async findById(id: TaskId) { const row = await segmentOne<SegmentTaskRow>('SELECT * FROM segment_calculation_task WHERE id=$1 AND is_deleted=false', [id]); return row ? this.adapter.fromPOToSegmentCalculationTask(row) : null; }
    async findBySegmentId(id: string, query: TaskQuery): Promise<Page<SegmentCalculationTask>> { const parts = ['segment_id=$1', 'is_deleted=false'], values: unknown[] = [id]; if (query.status) {
        values.push(query.status);
        parts.push('status=$' + values.length);
    } if (query.startTimeAfter) {
        values.push(query.startTimeAfter);
        parts.push('start_time>=$' + values.length);
    } if (query.startTimeBefore) {
        values.push(query.startTimeBefore);
        parts.push('start_time<=$' + values.length);
    } const { page, pageSize } = query, where = parts.join(' AND '); const [count, rows] = await Promise.all([segmentOne<{
            count: string;
        }>('SELECT count(*) AS count FROM segment_calculation_task WHERE ' + where, values), segmentRows<SegmentTaskRow>(`SELECT * FROM segment_calculation_task WHERE ${where} ORDER BY create_time DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, (page - 1) * pageSize])]); return { total: Number(count?.count ?? 0), items: rows.map(row => this.adapter.fromPOToSegmentCalculationTask(row)), page, pageSize }; }
    async findLatestBySegmentId(id: string) { const row = await segmentOne<SegmentTaskRow>('SELECT * FROM segment_calculation_task WHERE segment_id=$1 AND is_deleted=false ORDER BY start_time DESC LIMIT 1', [id]); return row ? this.adapter.fromPOToSegmentCalculationTask(row) : null; }
    async findPendingTasks() { return (await segmentRows<SegmentTaskRow>("SELECT * FROM segment_calculation_task WHERE status='PENDING' AND is_deleted=false ORDER BY create_time")).map(row => this.adapter.fromPOToSegmentCalculationTask(row)); }
}

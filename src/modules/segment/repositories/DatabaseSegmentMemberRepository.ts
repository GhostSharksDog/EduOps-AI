import type { Page, SegmentMemberRepository } from '../domain/ports/SegmentMemberRepository';
import type { SegmentMemberFilter } from '../domain/commands/SegmentMemberFilter';
import { SegmentMember } from '../domain/entities/SegmentMember';
import { JoinMethod } from '@/shared/enums';
import { transaction } from '@/platform/database';
import { randomUUID } from 'node:crypto';
import { verifyOwnership, createOwnershipError, type TenantFilterOptions } from '@/platform/get-current-tenant';
import { SegmentAdapterImpl } from './SegmentAdapterImpl';
import type { SegmentMemberRow, SegmentRow } from './row-types';
import { segmentRows, segmentOne, insertSegmentRow, addSegmentOwnership } from './sql';
function predicate(segmentId: string, filter?: TenantFilterOptions) { const parts = ['segment_id=$1', 'is_deleted=false'], values: unknown[] = [segmentId]; addSegmentOwnership(parts, values, filter); return { parts, values }; }
export class DatabaseSegmentMemberRepository implements SegmentMemberRepository {
    private readonly adapter = new SegmentAdapterImpl();
    async saveMembers(segmentId: string, members: SegmentMember[], filter?: TenantFilterOptions): Promise<void> { if (!members?.length)
        return; await transaction(async (tx) => { const segment = await segmentOne<SegmentRow>('SELECT * FROM segment WHERE id=$1 AND is_deleted=false FOR UPDATE', [segmentId], tx); if (!segment || !verifyOwnership(segment.ownedBy, filter))
        throw createOwnershipError('Segment', segmentId); for (const member of members) {
        if (member.ownedBy !== segment.ownedBy)
            throw createOwnershipError('SegmentMember', member.id);
        const old = await segmentOne<{
            id: string;
        }>('SELECT id FROM segment_member WHERE segment_id=$1 AND member_id=$2 AND is_deleted=false', [segmentId, member.memberId], tx);
        if (!old)
            await insertSegmentRow<SegmentMemberRow>('segment_member', { id: randomUUID(), segmentId, memberId: member.memberId, ownedBy: member.ownedBy, description: member.description ?? null, joinMethod: member.joinMethod, joinTime: member.joinedAt ?? new Date(), feature: member.feature ?? null, isDeleted: false, createdBy: member.createdBy ?? member.ownedBy }, tx);
    } }); }
    async clearMembers(segmentId: string, filter?: TenantFilterOptions): Promise<void> { await transaction(async (tx) => { const segment = await segmentOne<SegmentRow>('SELECT * FROM segment WHERE id=$1 FOR UPDATE', [segmentId], tx); if (!segment || !verifyOwnership(segment.ownedBy, filter))
        throw createOwnershipError('Segment', segmentId); await tx.query('DELETE FROM segment_member WHERE segment_id=$1', [segmentId]); }); }
    async findMembers(segmentId: string, filter: SegmentMemberFilter, tenant?: TenantFilterOptions): Promise<Page<SegmentMember>> { const { parts, values } = predicate(segmentId, tenant); if (filter.joinedAfter) {
        values.push(new Date(filter.joinedAfter));
        parts.push('join_time>=$' + values.length);
    } if (filter.joinedBefore) {
        values.push(new Date(filter.joinedBefore));
        parts.push('join_time<=$' + values.length);
    } const page = filter.pagination?.page ?? 1, pageSize = filter.pagination?.pageSize ?? 10, where = parts.join(' AND '); const [rows, count] = await Promise.all([segmentRows<SegmentMemberRow>(`SELECT * FROM segment_member WHERE ${where} ORDER BY join_time DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, (page - 1) * pageSize]), segmentOne<{
            count: string;
        }>('SELECT count(*) AS count FROM segment_member WHERE ' + where, values)]); return { items: rows.map(row => this.adapter.fromMemberPOToSegmentMember(row)), total: Number(count?.count ?? 0), page, pageSize }; }
    async countMembers(segmentId: string, filter?: TenantFilterOptions) { const { parts, values } = predicate(segmentId, filter); return Number((await segmentOne<{
        count: string;
    }>('SELECT count(*) AS count FROM segment_member WHERE ' + parts.join(' AND '), values))?.count ?? 0); }
    async isMember(segmentId: string, memberId: string, filter?: TenantFilterOptions) { const { parts, values } = predicate(segmentId, filter); values.push(memberId); parts.push('member_id=$' + values.length); return !!await segmentOne<{
        id: string;
    }>('SELECT id FROM segment_member WHERE ' + parts.join(' AND ') + ' LIMIT 1', values); }
}

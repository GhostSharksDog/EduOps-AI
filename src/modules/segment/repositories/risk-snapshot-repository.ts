import 'server-only';
import { transaction } from '@/platform/database';
import { randomUUID } from 'node:crypto';
import type { CreateRiskSegmentDTO, RiskSegmentRepository, RiskSegmentSnapshotVO, RiskSnapshotAggregate, SnapshotPageInput } from '../contracts/risk-snapshot';
import type { PublishedRiskTagVO } from '@/modules/tag/contracts';
import { WorkflowError } from '@/shared/errors/workflow-error';
import type { RiskSnapshotRow } from './row-types';
import { segmentRows, segmentOne, insertSegmentRow } from './sql';
// Project the public fields explicitly: returning payload as well as preview doubled large snapshots.
const vo = (row: RiskSnapshotRow): RiskSegmentSnapshotVO => ({id:row.id,segmentId:row.segmentId,sourceTagId:row.sourceTagId,tagVersion:row.tagVersion,datasetId:row.datasetId,name:row.name,memberCount:row.memberCount,createdAt:row.createdAt.toISOString(),preview:row.payload as RiskSegmentSnapshotVO['preview']});
const accessible=`FROM education_segment_snapshot snap JOIN segment s ON s.id=snap."segmentId" AND s.owned_by=snap."organizationId" AND s.is_deleted=false WHERE snap."organizationId"=$1`;
const fields=`snap.id,snap."segmentId",snap."sourceTagId",snap."tagVersion",snap."datasetId",snap.name,snap."memberCount",snap."createdAt"`;
const selected=`${accessible} AND (snap.id=$2 OR snap."segmentId"=$2)`;
export class DatabaseRiskSegmentRepository implements RiskSegmentRepository {
    async summaries(org:string){return (await segmentRows<RiskSnapshotRow>(`SELECT ${fields},snap.payload-'members'||jsonb_build_object('members','[]'::jsonb) AS payload ${accessible} ORDER BY snap."createdAt" DESC`,[org])).map(vo);}
    async page(org:string,id:string,input:SnapshotPageInput){
        const offset=(input.page-1)*input.pageSize;
        const row=await segmentOne<RiskSnapshotRow>(`SELECT ${fields},snap.payload-'members'||jsonb_build_object('members',COALESCE((SELECT jsonb_agg(m.member ORDER BY m.position) FROM (SELECT member,position FROM jsonb_array_elements(snap.payload->'members') WITH ORDINALITY AS a(member,position) ORDER BY position OFFSET $3 LIMIT $4) m),'[]'::jsonb)) AS payload ${selected}`,[org,id,offset,input.pageSize]);
        if(!row)throw new WorkflowError('人群快照不存在或无权访问',404);
        return {snapshot:vo(row),pagination:{...input,total:row.memberCount,hasNext:offset+input.pageSize<row.memberCount}};
    }
    async member(org:string,id:string,studentId:string){
        const row=await segmentOne<RiskSnapshotRow>(`SELECT ${fields},snap.payload-'members'||jsonb_build_object('members',COALESCE((SELECT jsonb_agg(m.member) FROM jsonb_array_elements(snap.payload->'members') AS m(member) WHERE m.member->>'studentId'=$3),'[]'::jsonb)) AS payload ${selected}`,[org,id,studentId]);
        if(!row)throw new WorkflowError('人群快照不存在或无权访问',404);return vo(row);
    }
    async aggregate(org:string,id:string):Promise<RiskSnapshotAggregate>{
        const row=await segmentOne<{result:RiskSnapshotAggregate}>(`WITH source AS (
          SELECT snap.payload ${selected}
        ), members AS (
          SELECT member,source.payload FROM source CROSS JOIN LATERAL jsonb_array_elements(source.payload->'members') AS m(member)
        ), cutoff AS (
          SELECT COALESCE((SELECT b->>'asOf' FROM members CROSS JOIN LATERAL jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b LIMIT 1),payload#>>'{scope,endDate}') AS day FROM source
        ), facts AS (
          SELECT member,payload,cutoff.day,
            jsonb_typeof(member->'due')='number' AS observed,
            jsonb_array_length(COALESCE(member->'business','[]'::jsonb))>0 AS has_business,
            EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b WHERE b#>>'{hours,status}'='ready') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b WHERE b#>>'{hours,status}'='unknown') AS known_balance,
            EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b WHERE b#>>'{hours,status}'='unknown') AS unknown_balance,
            COALESCE((SELECT sum((b#>>'{hours,remaining}')::numeric) FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b WHERE b#>>'{hours,status}'='ready'),0) AS balance,
            EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b->'contracts','[]'::jsonb)) c WHERE c->>'renewalEligible'='yes' AND COALESCE((c->>'renewed')::boolean,false)=false AND (c->>'endDate')::date BETWEEN cutoff.day::date AND cutoff.day::date+30) AS upcoming,
            EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b->'complaints','[]'::jsonb)) c WHERE (c->>'occurredAt')::timestamptz >= ((cutoff.day::date-29)::timestamp AT TIME ZONE 'Asia/Shanghai')) AS complained,
            jsonb_array_length(COALESCE(member->'business','[]'::jsonb))=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b WHERE NOT COALESCE((b->>'renewalComplete')::boolean,false) OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(b->'contracts','[]'::jsonb)) c WHERE c->>'renewalEligible' IS NULL)) AS renewal_unknown,
            jsonb_array_length(COALESCE(member->'business','[]'::jsonb))=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(member->'business','[]'::jsonb)) b WHERE NOT COALESCE((b->>'complaintsComplete')::boolean,false)) AS complaint_unknown
          FROM members CROSS JOIN cutoff
        ), labels AS (
          SELECT 'campus' AS key,COALESCE((SELECT c->>'name' FROM jsonb_array_elements(payload->'catalog') c WHERE c->>'id'=v LIMIT 1),v) AS label FROM facts CROSS JOIN LATERAL jsonb_array_elements_text(member->'campusIds') v
          UNION ALL SELECT 'course',COALESCE((SELECT c->>'name' FROM jsonb_array_elements(payload->'catalog') c WHERE c->>'id'=v LIMIT 1),v) FROM facts CROSS JOIN LATERAL jsonb_array_elements_text(member->'courseIds') v
          UNION ALL SELECT 'grade',member->>'gradeBand' FROM facts
          UNION ALL SELECT 'hours',CASE WHEN unknown_balance THEN '余额待核查' WHEN NOT known_balance THEN '无有效在班合约' WHEN balance=0 THEN '零余额' WHEN balance<=8 THEN '大于0至8' WHEN balance<=24 THEN '大于8至24' ELSE '大于24' END FROM facts
          UNION ALL SELECT 'expiry',CASE WHEN upcoming THEN '到期待跟进' WHEN renewal_unknown THEN '资格或数据待核查' ELSE '其他或无需续费' END FROM facts
          UNION ALL SELECT 'complaint',CASE WHEN complained THEN '近期发生客诉' WHEN complaint_unknown THEN '客诉数据待核查' ELSE '无近期客诉' END FROM facts
        ), distribution AS (
          SELECT key,jsonb_agg(jsonb_build_object('label',label,'count',n) ORDER BY label) AS "values" FROM (SELECT key,label,count(*) AS n FROM labels GROUP BY key,label) counts GROUP BY key
        ) SELECT jsonb_build_object(
          'attendance',jsonb_build_object('present',COALESCE(sum((member->>'present')::numeric) FILTER(WHERE observed),0),'due',COALESCE(sum((member->>'due')::numeric) FILTER(WHERE observed),0),'absent',COALESCE(sum((member->>'absent')::numeric) FILTER(WHERE observed),0),'leave',COALESCE(sum((member->>'leave')::numeric) FILTER(WHERE observed),0),'unknown',COALESCE(sum((member->>'unknown')::numeric) FILTER(WHERE observed),0),'observedStudents',count(*) FILTER(WHERE observed)),
          'hasBusiness',COALESCE(bool_or(has_business),false),'asOf',(SELECT day FROM cutoff),'knownBalanceStudents',count(*) FILTER(WHERE known_balance),'unknownBalanceStudents',count(*) FILTER(WHERE unknown_balance),
          'remainingHours',CASE WHEN COALESCE(bool_or(unknown_balance),false) THEN NULL ELSE round(sum(balance) FILTER(WHERE known_balance),2) END,
          'renewalFollowupStudents',CASE WHEN COALESCE(bool_or(renewal_unknown),false) THEN NULL ELSE count(*) FILTER(WHERE upcoming) END,
          'recentComplaintStudents',CASE WHEN COALESCE(bool_or(complaint_unknown),false) THEN NULL ELSE count(*) FILTER(WHERE complained) END,
          'upcomingCount',count(*) FILTER(WHERE upcoming),'complainedCount',count(*) FILTER(WHERE complained),
          'distributions',COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key,'values',"values")) FROM distribution),'[]'::jsonb)
        ) AS result FROM facts HAVING EXISTS(SELECT 1 FROM source)`,[org,id]);
        if(!row)throw new WorkflowError('人群快照不存在或无权访问',404);return row.result;
    }
    async list(org: string) { return (await segmentRows<RiskSnapshotRow>('SELECT snap.* FROM education_segment_snapshot snap JOIN segment s ON s.id=snap."segmentId" AND s.owned_by=snap."organizationId" AND s.is_deleted=false WHERE snap."organizationId"=$1 ORDER BY snap."createdAt" DESC', [org])).map(vo); }
    async get(org: string, id: string) { const row = await segmentOne<RiskSnapshotRow>('SELECT snap.* FROM education_segment_snapshot snap JOIN segment s ON s.id=snap."segmentId" AND s.owned_by=snap."organizationId" AND s.is_deleted=false WHERE snap."organizationId"=$1 AND (snap.id=$2 OR snap."segmentId"=$2)', [org, id]); if (!row)
        throw new WorkflowError('人群快照不存在或无权访问', 404); return vo(row); }
    async create(org: string, user: string, input: CreateRiskSegmentDTO, source: PublishedRiskTagVO) {
        return transaction(async (tx) => {
            await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [org + '-' + source.tagId]);
            const old = await segmentOne<RiskSnapshotRow>('SELECT * FROM education_segment_snapshot WHERE "organizationId"=$1 AND "sourceTagId"=$2 AND "tagVersion"=$3', [org, source.tagId, source.version], tx);
            if (old) {
                if (old.name !== input.name)
                    throw new WorkflowError('该标签版本已有成员快照，请使用已有的人群');
                return vo(old);
            }
            const segmentId = randomUUID(), taskId = randomUUID(), snapshotId = randomUUID(), now = new Date(), members = [...new Set(source.preview.members.map(m => m.studentId))];
            if (members.length !== source.preview.memberCount)
                throw new WorkflowError('标签成员数据不一致，无法建立快照');
            await insertSegmentRow('segment', { id: segmentId, name: input.name, ownedBy: org, createdBy: user, entityType: 'STUDENT', computeType: 'OFFLINE', status: 'ACTIVE', lastCalculationTime: now, feature: { engine: source.preview.calculatorVersion==='attendance-v1'?'education-attendance-v1':'education-business-rules-v1', snapshotId, sourceTagId: source.tagId, tagVersion: source.version, memberCount: members.length } }, tx);
            await insertSegmentRow('segment_calculation_task', { id: taskId, ownedBy: org, segmentId, status: 'COMPLETED', startTime: now, endTime: now, resultCount: members.length, createdBy: user, feature: { snapshotId, sourceFingerprint: source.preview.sourceFingerprint } }, tx);
            if (members.length)
                await tx.query("INSERT INTO segment_member(id,owned_by,segment_id,member_id,join_time,join_method,created_by,feature) SELECT gen_random_uuid(),$1::uuid,$2::uuid,member_id,$3::timestamp,'RULE',$4::uuid,$5::jsonb FROM unnest($6::text[]) AS members(member_id)", [org, segmentId, now, user, JSON.stringify({ snapshotId }), members]);
            const snapshot = await segmentOne<RiskSnapshotRow>('INSERT INTO education_segment_snapshot (id,"organizationId","segmentId","sourceTagId","tagVersion","datasetId",name,payload,"memberCount","createdBy") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *', [snapshotId, org, segmentId, source.tagId, source.version, source.preview.dataset.id, input.name, JSON.stringify(source.preview), members.length, user], tx);
            if (!snapshot)
                throw new WorkflowError('创建人群快照失败');
            return vo(snapshot);
        }, { timeoutMs: 30000 });
    }
}

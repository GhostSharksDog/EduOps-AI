import 'server-only';
import {queryOne,queryRows} from '@/platform/database';
import type {WorkbenchActor,WorkbenchItem,WorkbenchReadOptions,WorkbenchSourceData} from '@/shared/contracts/workbench';
import {workbenchDataset,workbenchPeriod,workbenchRecordLink} from '@/shared/lib/workbench-record';

interface AnalysisSummaryRow {id:string;title:string;status:string;updatedAt:Date;datasetId:string;datasetName:string|null;datasetOrigin:string|null;analysisType:string|null;scope:unknown;}
interface PlanSummaryRow extends AnalysisSummaryRow {sessionId:string;planId:string|null;planVersion:number|null;expiresAt:string|null;legacyProposalId:string|null;expired:boolean;}
// JSON projection stays in PostgreSQL: no execution messages, answers, model inputs,
// tool steps, rule members or complete action-plan objects cross this read boundary.
const plans=`WITH mine AS (
 SELECT e.id,e."sessionId",s.title,
   COALESCE(plan.status,legacy.status) AS status,plan."planId",plan."planVersion",legacy.id AS "legacyProposalId",
   COALESCE(plan."expiresAt",legacy."expiresAt") AS "expiresAt",
   COALESCE(CASE WHEN plan."updatedText" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN plan."updatedText"::timestamptz END,legacy."updatedAt",e."completedAt",e."startedAt") AS "updatedAt",
   COALESCE(plan."datasetId",legacy."datasetId",context."datasetId",s."datasetId") AS "datasetId",
   COALESCE(plan.scope,legacy.scope,context.scope,s.scope) AS scope
 FROM agent_execution e JOIN agent_session s ON s.id=e."sessionId" AND s."organizationId"=e."organizationId"
 LEFT JOIN LATERAL (
   SELECT step#>>'{actionPlan,id}' AS "planId",(step#>>'{actionPlan,version}')::int AS "planVersion",
     step#>>'{actionPlan,status}' AS status,COALESCE(NULLIF(step#>>'{actionPlan,expiresAt}',''),CASE WHEN step#>>'{actionPlan,createdAt}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN ((step#>>'{actionPlan,createdAt}')::timestamptz+INTERVAL '30 minutes')::text END) AS "expiresAt",
     step#>>'{actionPlan,updatedAt}' AS "updatedText",(step#>>'{actionPlan,datasetId}')::uuid AS "datasetId",step#>'{actionPlan,scope}' AS scope
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.steps)='array' THEN e.steps ELSE '[]'::jsonb END) WITH ORDINALITY a(step,position)
   WHERE jsonb_typeof(step->'actionPlan')='object' ORDER BY position DESC LIMIT 1
 ) plan ON TRUE
 LEFT JOIN LATERAL (
   SELECT (step#>>'{context,datasetId}')::uuid AS "datasetId",step#>'{context,scope}' AS scope
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.steps)='array' THEN e.steps ELSE '[]'::jsonb END) WITH ORDINALITY a(step,position)
   WHERE jsonb_typeof(step->'context')='object' ORDER BY position DESC LIMIT 1
 ) context ON TRUE
 LEFT JOIN LATERAL (
   SELECT p.id,p.status,p."updatedAt",p."datasetId",p.scope,CASE WHEN p.preview->>'createdAt' IS NOT NULL THEN LEAST(NULLIF(p.preview->>'expiresAt','')::timestamptz,(p.preview->>'createdAt')::timestamptz+INTERVAL '30 minutes')::text ELSE p.preview->>'expiresAt' END AS "expiresAt"
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.proposals)='array' THEN e.proposals ELSE '[]'::jsonb END) WITH ORDINALITY a(proposal,position)
   JOIN education_risk_proposal p ON p.id::text=proposal->>'id' AND p."organizationId"=e."organizationId" AND p."createdBy"=$2::uuid
   WHERE plan."planId" IS NULL AND p.status<>'published' ORDER BY position DESC LIMIT 1
 ) legacy ON TRUE
 WHERE e."organizationId"=$1::uuid AND e."createdBy"=$2::uuid
),pending AS (
 SELECT mine.id,mine."sessionId",mine.title,mine.status,mine."planId",mine."planVersion",mine."legacyProposalId",mine."expiresAt",mine."updatedAt",mine."datasetId",mine.scope,
   CASE WHEN mine."expiresAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN mine."expiresAt"::timestamptz<=CURRENT_TIMESTAMP ELSE FALSE END AS expired
 FROM mine WHERE ("planId" IS NOT NULL AND status IN ('prepared','executing','partially_failed','invalid')) OR ("planId" IS NULL AND "legacyProposalId" IS NOT NULL)
)`;
function planItem(row:PlanSummaryRow,actor:WorkbenchActor):WorkbenchItem{
 const needsPrepare=row.expired||row.status==='invalid',partial=row.status==='partially_failed',canAct=['admin','operator'].includes(actor.role)&&row.status!=='executing';
 return {id:row.planId??row.legacyProposalId??row.id,kind:'plan',title:row.title,status:needsPrepare?'invalid':row.status,statusLabel:needsPrepare?'需要重新准备':partial?'部分完成':row.status==='executing'?'执行中':'待确认',updatedAt:row.updatedAt.toISOString(),href:workbenchRecordLink('plan',row.id,{sessionId:row.sessionId,datasetId:row.datasetId,scope:row.scope}),canAct,actionLabel:canAct?(needsPrepare?'重新准备':partial?'继续处理':'核对方案'):'查看',version:row.planVersion??undefined,expiresAt:row.expiresAt??undefined,dataset:workbenchDataset(row),periodLabel:workbenchPeriod(row.scope)};
}
/** The workbench never runs timeout cleanup or resumes a business operation. */
export async function readAgentWorkbench(actor:WorkbenchActor,options:WorkbenchReadOptions):Promise<WorkbenchSourceData>{
 const args=[actor.organizationId,actor.userId];
 const [count,todos,recent]=await Promise.all([
  queryOne<{count:number}>(`${plans} SELECT count(*)::int AS count FROM pending`,args),
  queryRows<PlanSummaryRow>(`${plans} SELECT p.id,p."sessionId",p.title,p.status,p."planId",p."planVersion",p."legacyProposalId",p."expiresAt",p."updatedAt",p."datasetId",p.scope,p.expired,d.name AS "datasetName",d.origin AS "datasetOrigin",d."analysisType" FROM pending p LEFT JOIN education_dataset d ON d.id=p."datasetId" AND d."organizationId"=$1::uuid ORDER BY p."updatedAt" DESC,p.id LIMIT $3`,[...args,options.todoLimit]),
  queryRows<AnalysisSummaryRow>(`SELECT s.id,s.title,COALESCE(run.status,'saved') AS status,s."updatedAt",COALESCE(context."datasetId",s."datasetId") AS "datasetId",COALESCE(context.scope,s.scope) AS scope,d.name AS "datasetName",d.origin AS "datasetOrigin",d."analysisType" FROM agent_session s LEFT JOIN LATERAL (SELECT e.status,e.steps FROM agent_execution e WHERE e."sessionId"=s.id AND e."organizationId"=s."organizationId" AND e."createdBy"=$2::uuid ORDER BY e."startedAt" DESC,e.id LIMIT 1) run ON TRUE LEFT JOIN LATERAL (SELECT (step#>>'{context,datasetId}')::uuid AS "datasetId",step#>'{context,scope}' AS scope FROM jsonb_array_elements(CASE WHEN jsonb_typeof(run.steps)='array' THEN run.steps ELSE '[]'::jsonb END) WITH ORDINALITY a(step,position) WHERE jsonb_typeof(step->'context')='object' ORDER BY position DESC LIMIT 1) context ON TRUE LEFT JOIN education_dataset d ON d.id=COALESCE(context."datasetId",s."datasetId") AND d."organizationId"=s."organizationId" WHERE s."organizationId"=$1::uuid AND s."createdBy"=$2::uuid ORDER BY s."updatedAt" DESC,s.id LIMIT $3`,[...args,options.recentLimit]),
 ]);
 return {count:count?.count??0,todos:todos.map(row=>planItem(row,actor)),recent:recent.map(row=>({id:row.id,kind:'analysis',title:row.title,status:row.status,statusLabel:({saved:'已保存',queued:'等待分析',running:'分析中',awaiting_confirmation:'有待确认方案',completed:'已完成',failed:'执行失败'} as Record<string,string>)[row.status]??row.status,updatedAt:row.updatedAt.toISOString(),href:workbenchRecordLink('analysis',row.id,{datasetId:row.datasetId,scope:row.scope}),canAct:false,actionLabel:'查看',dataset:workbenchDataset(row),periodLabel:workbenchPeriod(row.scope)}))};
}

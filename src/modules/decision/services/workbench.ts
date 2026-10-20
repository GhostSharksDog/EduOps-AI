import 'server-only';
import {queryOne,queryRows} from '@/platform/database';
import type {WorkbenchActor,WorkbenchItem,WorkbenchReadOptions,WorkbenchSourceData} from '@/shared/contracts/workbench';
import {workbenchRecordLink,workbenchPeriod,workbenchDataset} from '@/shared/lib/workbench-record';

interface TaskSummaryRow {id:string;title:string;state:string;dueDate:string;updatedAt:Date;version:number;datasetId:string;datasetName:string|null;datasetOrigin:string|null;analysisType:string|null;scope:unknown;}
const fields=`t.id,t.action AS title,t.state,t."dueDate",t."updatedAt",t.version,t."datasetId",t."sourceSnapshot"->'scope' AS scope,d.name AS "datasetName",d.origin AS "datasetOrigin",d."analysisType"`;
const join=`FROM decision_task t LEFT JOIN education_dataset d ON d.id=t."datasetId" AND d."organizationId"=t."organizationId"`;
const active=`t."organizationId"=$1::uuid AND t."ownerId"=$2::uuid AND t.state IN ('accepted','executing','review_pending')`;
const labels:Record<string,string>={accepted:'待执行',executing:'执行中',review_pending:'待复核',deferred:'已暂缓',rejected:'未采纳',completed:'已复核'};
function item(row:TaskSummaryRow,actor:WorkbenchActor,today:string):WorkbenchItem{
 const canAct=['admin','operator'].includes(actor.role)&&['accepted','executing','review_pending'].includes(row.state),overdue=['accepted','executing','review_pending'].includes(row.state)&&row.dueDate<today;
 return {id:row.id,kind:'task',title:row.title,status:row.state,statusLabel:labels[row.state]??row.state,updatedAt:row.updatedAt.toISOString(),dueDate:row.dueDate,overdue,version:row.version,canAct,actionLabel:canAct?(row.state==='review_pending'?'完成复核':row.state==='executing'?'继续执行':'安排执行'):'查看',href:workbenchRecordLink('task',row.id,{datasetId:row.datasetId,scope:row.scope}),dataset:workbenchDataset(row),periodLabel:workbenchPeriod(row.scope)};
}
/** Read only the current account's task metadata; source answers and feedback remain in their own detail page. */
export async function readDecisionWorkbench(actor:WorkbenchActor,options:WorkbenchReadOptions):Promise<WorkbenchSourceData>{
 const args=[actor.organizationId,actor.userId];
 const [count,todos,recent]=await Promise.all([
  queryOne<{count:number}>(`SELECT count(*)::int AS count FROM decision_task t WHERE ${active}`,args),
  queryRows<TaskSummaryRow>(`SELECT ${fields} ${join} WHERE ${active} ORDER BY CASE WHEN t."dueDate"<$3 THEN 0 WHEN t.state='review_pending' THEN 1 ELSE 2 END,CASE WHEN t."dueDate"<$3 THEN t."dueDate" END ASC,t."updatedAt" DESC,t.id LIMIT $4`,[...args,options.today,options.todoLimit]),
  queryRows<TaskSummaryRow>(`SELECT ${fields} ${join} WHERE t."organizationId"=$1::uuid AND (t."createdBy"=$2::uuid OR t."ownerId"=$2::uuid) ORDER BY t."updatedAt" DESC,t.id LIMIT $3`,[...args,options.recentLimit]),
 ]);
 return {count:count?.count??0,todos:todos.map(row=>item(row,actor,options.today)),recent:recent.map(row=>item(row,actor,options.today))};
}

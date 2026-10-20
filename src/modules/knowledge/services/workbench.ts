import 'server-only';
import {queryOne,queryRows} from '@/platform/database';
import type {WorkbenchActor,WorkbenchItem,WorkbenchReadOptions,WorkbenchSourceData} from '@/shared/contracts/workbench';
import {workbenchPeriod,workbenchRecordLink} from '@/shared/lib/workbench-record';

interface MaterialSummaryRow {id:string;title:string;version:number;status:string;indexStatus:string;updatedAt:Date;period:unknown;}
// Determine the true latest version before restricting its creator. An older personal draft
// must not be returned as pending when another account has already created its replacement.
const latest=`WITH latest AS (SELECT DISTINCT ON ("logicalSourceId") id,"logicalSourceId",title,version,status,"indexStatus","updatedAt",period,"createdBy" FROM knowledge_source_version WHERE "organizationId"=$1::uuid ORDER BY "logicalSourceId",version DESC,"createdAt" DESC,id),mine AS (SELECT id,title,version,status,"indexStatus","updatedAt",period FROM latest WHERE "createdBy"=$2::uuid)`;
const pending=`status='draft' OR ("indexStatus"='failed' AND status<>'superseded')`;
function item(row:MaterialSummaryRow,actor:WorkbenchActor):WorkbenchItem{
 const failed=row.indexStatus==='failed',pendingReview=row.status==='draft',canAct=['admin','operator'].includes(actor.role)&&(failed||pendingReview);
 return {id:row.id,kind:'material',title:row.title,status:failed?'failed':pendingReview?'draft':row.indexStatus==='indexing'?'indexing':row.status,statusLabel:failed?'准备失败':pendingReview?'待审核':row.indexStatus==='indexing'?'准备中':row.indexStatus==='ready'?'已可使用':'待准备',updatedAt:row.updatedAt.toISOString(),version:row.version,href:workbenchRecordLink('material',row.id),canAct,actionLabel:canAct?(failed?'重新准备':'核对并审核'):'查看',periodLabel:workbenchPeriod(row.period)};
}
export async function readKnowledgeWorkbench(actor:WorkbenchActor,options:WorkbenchReadOptions):Promise<WorkbenchSourceData>{
 const args=[actor.organizationId,actor.userId];
 const [count,todos,recent]=await Promise.all([
  queryOne<{count:number}>(`${latest} SELECT count(*)::int AS count FROM mine WHERE ${pending}`,args),
  queryRows<MaterialSummaryRow>(`${latest} SELECT id,title,version,status,"indexStatus","updatedAt",period FROM mine WHERE ${pending} ORDER BY "updatedAt" DESC,id LIMIT $3`,[...args,options.todoLimit]),
  queryRows<MaterialSummaryRow>(`${latest} SELECT id,title,version,status,"indexStatus","updatedAt",period FROM mine ORDER BY "updatedAt" DESC,id LIMIT $3`,[...args,options.recentLimit]),
 ]);
 return {count:count?.count??0,todos:todos.map(row=>item(row,actor)),recent:recent.map(row=>item(row,actor))};
}

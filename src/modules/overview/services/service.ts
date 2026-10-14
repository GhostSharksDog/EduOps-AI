import 'server-only';
import {queryOne,queryRows} from '@/platform/database';
import {modelConfiguration} from '@/platform/ai/client';
import {capabilities} from './capabilities';
import {riskSegments} from '@/modules/segment/server';
import type {AlertVO,AlertHit} from '@/modules/alert/contracts';
import type {ReportVO} from '@/modules/report/contracts';
import type {OverviewResult} from '../contracts';
export async function getOverview(organizationId:string):Promise<OverviewResult>{
 const result:OverviewResult={databaseStatus:'unconfigured',configuration:modelConfiguration(),inventory:null,capabilities:capabilities.map(c=>({...c})),dataCutoff:null};
 result.capabilities=result.capabilities.map(c=>c.id==='knowledge'&&!result.configuration.embeddingConfigured?{...c,status:'unconfigured',description:'可管理知识来源；配置向量模型后可审核入库和检索。'}:c.id==='agent'&&!result.configuration.chatConfigured?{...c,status:'unconfigured',description:'配置对话模型后可查询指标、解释结果并辅助创建风险草稿。'}:c);
 try{
  const row=await queryOne(`SELECT
   (SELECT COUNT(*)::int FROM tag WHERE owned_by=$1 AND NOT is_deleted) AS tags,
   (SELECT COUNT(*)::int FROM segment WHERE owned_by=$1 AND NOT is_deleted) AS segments,
   (SELECT COUNT(*)::int FROM data_sources WHERE owned_by=$1 AND NOT is_deleted) AS "dataSources",
   (SELECT COUNT(*)::int FROM data_model WHERE owned_by=$1 AND NOT is_deleted) AS "dataModels"`,[organizationId]);
  result.inventory=row as OverviewResult['inventory'];result.databaseStatus='ready';
 }catch{result.databaseStatus='error';result.capabilities=result.capabilities.map(c=>c.status==='ready'?{...c,status:'error'}:c);}
 try{const snapshots=await riskSegments.summaries(organizationId);result.riskSnapshots={status:'ready',items:snapshots.slice(0,5).map(s=>({id:s.id,name:s.name,memberCount:s.memberCount,datasetName:s.preview.dataset.name,origin:s.preview.dataset.origin,startDate:s.preview.scope.startDate,endDate:s.preview.scope.endDate}))};}catch{result.riskSnapshots={status:'error',items:[]};}
 result.operations={alerts:{status:'error',items:[]},reports:{status:'error',items:[]}};
 try{result.operations.alerts={status:'ready',items:await queryRows<Omit<AlertVO,'createdAt'|'updatedAt'> & {hit:AlertHit;createdAt:Date;updatedAt:Date}>(`SELECT id,"datasetId","scopeKey",fingerprint,hit,snapshot,state,active,version,note,"createdAt","updatedAt" FROM operational_alert WHERE "organizationId"=$1 AND active AND state<>'resolved' ORDER BY "createdAt" DESC LIMIT 5`,[organizationId]).then(rows=>rows.map(r=>{const {hit,...record}=r;return {...hit,...record,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()};}))};}catch{result.capabilities=result.capabilities.map(c=>c.id==='alerts'?{...c,status:'error',description:'预警服务暂不可用，请联系管理员检查。'}:c);}
 try{result.operations.reports={status:'ready',items:await queryRows<Omit<ReportVO,'createdAt'|'completedAt'> & {createdAt:Date;completedAt:Date|null}>(`SELECT id,"datasetId",kind,status,snapshot,facts,answer,evidence,steps,"errorMessage","createdAt","completedAt" FROM operational_report WHERE "organizationId"=$1 AND status='completed' ORDER BY "createdAt" DESC LIMIT 5`,[organizationId]).then(rows=>rows.map(r=>({...r,createdAt:r.createdAt.toISOString(),completedAt:r.completedAt?.toISOString()??null})))};}catch{result.capabilities=result.capabilities.map(c=>c.id==='reports'?{...c,status:'error',description:'报告服务暂不可用，请联系管理员检查。'}:c);}
 if(!result.configuration.chatConfigured||!result.configuration.embeddingConfigured)result.capabilities=result.capabilities.map(c=>c.id==='reports'&&c.status!=='error'?{...c,status:'unconfigured',description:'可查询已有报告；生成需要分别配置对话模型和向量模型。'}:c);
 return result;
}

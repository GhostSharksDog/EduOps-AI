import 'server-only';
import {queryRows} from '@/platform/database';
import type {WorkbenchActor,WorkbenchReadOptions,WorkbenchSourceData} from '@/shared/contracts/workbench';
import {workbenchDataset,workbenchPeriod,workbenchRecordLink} from '@/shared/lib/workbench-record';

interface ReportSummaryRow {id:string;kind:string;status:string;updatedAt:Date;datasetId:string;datasetName:string|null;datasetOrigin:string|null;analysisType:string|null;scope:unknown;}
/** Intentionally bypasses reportService.list, which expires jobs and loads full frozen reports. */
export async function readReportWorkbench(actor:WorkbenchActor,options:WorkbenchReadOptions):Promise<WorkbenchSourceData>{
 const rows=await queryRows<ReportSummaryRow>(`SELECT r.id,r.kind,r.status,COALESCE(r."completedAt",r."createdAt") AS "updatedAt",r."datasetId",r.snapshot->'scope' AS scope,d.name AS "datasetName",d.origin AS "datasetOrigin",d."analysisType" FROM operational_report r LEFT JOIN education_dataset d ON d.id=r."datasetId" AND d."organizationId"=r."organizationId" WHERE r."organizationId"=$1::uuid AND r."createdBy"=$2::uuid ORDER BY COALESCE(r."completedAt",r."createdAt") DESC,r.id LIMIT $3`,[actor.organizationId,actor.userId,options.recentLimit]);
 return {count:0,todos:[],recent:rows.map(row=>({id:row.id,kind:'report',title:(row.kind==='monthly'?'月报':'周报')+' · '+(workbenchPeriod(row.scope)??row.datasetName??'已保存报告'),status:row.status,statusLabel:({completed:'已生成',failed:'生成失败',generating:'生成中'} as Record<string,string>)[row.status]??row.status,updatedAt:row.updatedAt.toISOString(),href:workbenchRecordLink('report',row.id,{datasetId:row.datasetId,scope:row.scope}),actionLabel:'查看',canAct:false,dataset:workbenchDataset(row),periodLabel:workbenchPeriod(row.scope)}))};
}

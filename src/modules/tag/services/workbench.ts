import 'server-only';
import {queryRows} from '@/platform/database';
import type {WorkbenchActor,WorkbenchReadOptions,WorkbenchSourceData} from '@/shared/contracts/workbench';
import {workbenchDataset,workbenchPeriod,workbenchRecordLink} from '@/shared/lib/workbench-record';

interface TagSummaryRow {id:string;name:string;status:string;version:number;updatedAt:Date;datasetId:string;datasetName:string|null;datasetOrigin:string|null;analysisType:string|null;scope:unknown;}
export async function readTagWorkbench(actor:WorkbenchActor,options:WorkbenchReadOptions):Promise<WorkbenchSourceData>{
 const rows=await queryRows<TagSummaryRow>(`SELECT p.id,p.name,p.status,p.version,p."updatedAt",p."datasetId",p.scope,d.name AS "datasetName",d.origin AS "datasetOrigin",d."analysisType" FROM education_risk_proposal p LEFT JOIN education_dataset d ON d.id=p."datasetId" AND d."organizationId"=p."organizationId" WHERE p."organizationId"=$1::uuid AND p."createdBy"=$2::uuid AND (p."publishedTagId" IS NULL OR EXISTS(SELECT 1 FROM tag t WHERE t.id=p."publishedTagId" AND t.owned_by=p."organizationId" AND t.is_deleted=FALSE)) ORDER BY p."updatedAt" DESC,p.id LIMIT $3`,[actor.organizationId,actor.userId,options.recentLimit]);
 return {count:0,todos:[],recent:rows.map(row=>({id:row.id,kind:'tag',title:row.name,status:row.status,statusLabel:({draft:'草稿',awaiting_confirmation:'待发布',published:'已发布'} as Record<string,string>)[row.status]??row.status,version:row.version,updatedAt:row.updatedAt.toISOString(),href:workbenchRecordLink('tag',row.id,{datasetId:row.datasetId,scope:row.scope}),canAct:false,actionLabel:'查看',dataset:workbenchDataset(row),periodLabel:workbenchPeriod(row.scope)}))};
}

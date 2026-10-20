import 'server-only';
import {queryRows} from '@/platform/database';
import type {WorkbenchActor,WorkbenchReadOptions,WorkbenchSourceData} from '@/shared/contracts/workbench';
import {workbenchDataset,workbenchPeriod,workbenchRecordLink} from '@/shared/lib/workbench-record';

interface SegmentSummaryRow {id:string;name:string;updatedAt:Date;datasetId:string;datasetName:string|null;datasetOrigin:string|null;analysisType:string|null;scope:unknown;}
export async function readSegmentWorkbench(actor:WorkbenchActor,options:WorkbenchReadOptions):Promise<WorkbenchSourceData>{
 const rows=await queryRows<SegmentSummaryRow>(`SELECT snap.id,snap.name,snap."createdAt" AS "updatedAt",snap."datasetId",snap.payload->'scope' AS scope,d.name AS "datasetName",d.origin AS "datasetOrigin",d."analysisType" FROM education_segment_snapshot snap JOIN segment s ON s.id=snap."segmentId" AND s.owned_by=snap."organizationId" AND s.is_deleted=FALSE LEFT JOIN education_dataset d ON d.id=snap."datasetId" AND d."organizationId"=snap."organizationId" WHERE snap."organizationId"=$1::uuid AND snap."createdBy"=$2::uuid ORDER BY snap."createdAt" DESC,snap.id LIMIT $3`,[actor.organizationId,actor.userId,options.recentLimit]);
 return {count:0,todos:[],recent:rows.map(row=>({id:row.id,kind:'segment',title:row.name,status:'saved',statusLabel:'已保存人群',updatedAt:row.updatedAt.toISOString(),href:workbenchRecordLink('segment',row.id,{datasetId:row.datasetId,scope:row.scope}),canAct:false,actionLabel:'查看',dataset:workbenchDataset(row),periodLabel:workbenchPeriod(row.scope)}))};
}

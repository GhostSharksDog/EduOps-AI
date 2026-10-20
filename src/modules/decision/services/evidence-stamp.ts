import 'server-only';
import {queryOne} from '@/platform/database';

/** 仅校验当前数据集的任务元数据，不读取建议正文或反馈。 */
export async function decisionEvidenceStamp(organizationId:string,datasetId:string):Promise<string>{
 const row=await queryOne<{stamp:string}>(`SELECT md5(COALESCE(string_agg(id::text||':'||version::text||':'||state,'|' ORDER BY id),'')) AS stamp FROM decision_task WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid`,[organizationId,datasetId]);
 return row?.stamp??'';
}

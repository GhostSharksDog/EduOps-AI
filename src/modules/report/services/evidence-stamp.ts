import 'server-only';
import {queryOne} from '@/platform/database';

export async function reportEvidenceStamp(organizationId:string,datasetId:string):Promise<string>{
 const row=await queryOne<{stamp:string}>(`SELECT md5(COALESCE(string_agg(id::text||':'||status||':'||COALESCE("completedAt"::text,''),'|' ORDER BY id),'')) AS stamp FROM operational_report WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid`,[organizationId,datasetId]);
 return row?.stamp??'';
}

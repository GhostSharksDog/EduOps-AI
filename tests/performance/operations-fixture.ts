import {createHash,randomUUID} from 'node:crypto';
import {DatabaseEducationStorage} from '../../src/modules/education/repositories/storage';
import {generateSimulationV3} from '../../src/modules/education/domain/simulation-v3';
import {normalizeRows} from '../../src/modules/education/domain/normalize';
import {metadataKinds,type EducationSnapshot,type RecordKind,type StoredEducationRow} from '../../src/modules/education/contracts';
import {execute,queryOne} from '../../src/platform/database';
import {EducationEventsClient} from '../../src/platform/database/education-events';
export function guardOperationsTest(){
 const url=new URL(process.env.DATABASE_URL??'');
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='25432'||url.pathname!=='/education_cleanup_test'||!['127.0.0.1','localhost'].includes(process.env.CLICKHOUSE_HOST??'')||process.env.CLICKHOUSE_PORT!=='28123'||process.env.CLICKHOUSE_DATABASE!=='education_cleanup_test')throw Error('经营基准仅允许 PostgreSQL25432/education_cleanup_test 与 ClickHouse28123/education_cleanup_test');
}
/** 扩展签到为同状态重复来源、课耗为等额细分账本。基准仍能由小规模纯计算器核验。 */
export async function seedOperationsFixture(options:{students?:number;replication?:number;organizationId?:string}={}){
 guardOperationsTest();if((await queryOne<{name:string}>('SELECT current_database() name'))?.name!=='education_cleanup_test')throw Error('测试数据库身份不匹配');
 const org=options.organizationId??randomUUID(),replication=options.replication??1,source=generateSimulationV3({seed:20261013,students:options.students??40});
 if(!Number.isInteger(replication)||replication<1||replication>64||(replication&(replication-1))!==0)throw Error('课耗细分倍数须为不超过64的2次幂，避免浮点账本失真');
 const storage=new DatabaseEducationStorage(),expectedRows=Object.fromEntries(Object.entries(source.data).map(([kind,rows])=>[kind,(rows?.length??0)*(['attendance','hours'].includes(kind)?replication:1)]));
 const dataset=await storage.createDataset(org,{...source.dataset,key:'benchmark-'+randomUUID(),name:'隔离经营性能实验（固定种子20261013）',analysisType:'operations',expectedRows,description:'专用_test库性能实验。签到重复来源、课耗等额分拆，正常项目及原第三版数据不扩容。'}),snapshot:EducationSnapshot={dataset,batches:[],records:[]};
 for(const [kind,raw] of Object.entries(source.data) as [RecordKind,Record<string,unknown>[]][]){
  const normalized=normalizeRows(dataset,kind,raw.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v===null?'':String(v)]))),{},kind+'.csv');if(normalized.rejectedRows)throw Error(kind+'生成数据存在校验错误');
  const fingerprint=createHash('sha256').update(JSON.stringify({seed:20261013,students:options.students??40,replication,kind,rows:raw})).digest('hex');
  const batch=await storage.createBatch(org,{datasetId:dataset.id,kind,filename:'benchmark-'+kind+'.csv',csv:'',mapping:{__benchmark:'operations-v1'}},fingerprint),baseRows=normalized.rows.map(r=>({...r,batchId:batch.id,hash:createHash('sha256').update(JSON.stringify(r)).digest('hex')}));
  snapshot.records.push(...baseRows);let count=0,chunk:StoredEducationRow[]=[];
  const flush=async()=>{if(!chunk.length)return;await storage.writeRecords(org,dataset.id,batch.id,chunk);chunk=[];};
  for(const row of baseRows){const copies=['attendance','hours'].includes(kind)?replication:1;for(let i=0;i<copies;i++){const sourceId=copies>1?row.sourceId+':part:'+i:row.sourceId,payload=copies>1?{...row.payload,id:sourceId,...(kind==='hours'?{hours:Number(row.payload.hours)/copies}:{})}:row.payload;chunk.push({...row,sourceId,payload,hash:createHash('sha256').update(JSON.stringify({sourceId,payload})).digest('hex')});count++;if(chunk.length>=5000)await flush();}}
  await flush();const completed=await storage.finishBatch(batch.id,{status:'completed',inputRows:count,acceptedRows:count,rejectedRows:0,duplicateRows:0,issues:[],error:null});snapshot.batches.push(completed);
 }
 return{org,datasetId:dataset.id,snapshot,expectedRows,eventRows:Object.entries(expectedRows).filter(([kind])=>!metadataKinds.includes(kind as RecordKind)).reduce((n,[,rows])=>n+rows,0),replication};
}
export async function deleteOperationsFixture(org:string){guardOperationsTest();await new EducationEventsClient().execute('ALTER TABLE education_events_v1 DELETE WHERE organization_id={org:UUID} SETTINGS mutations_sync=1',{org});await execute('DELETE FROM education_record WHERE "organizationId"=$1::uuid',[org]);await execute('DELETE FROM education_import_batch WHERE "organizationId"=$1::uuid',[org]);await execute('DELETE FROM education_dataset WHERE "organizationId"=$1::uuid',[org]);}

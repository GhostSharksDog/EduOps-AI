import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {queryRows,queryOne,transaction,execute} from '@/platform/database';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {AgentActor} from '@/modules/agent/contracts';
import {operations} from '@/modules/analytics/server';
import type {AlertVO,AlertEvaluationDTO,AlertUpdateDTO,AlertReplayDTO,AlertReplayResult,AlertReplayCase,AlertRulesUpdateDTO} from '../contracts';
import {evaluateRules} from '../domain/rules';
import {summarizeReplay} from '../domain/replay';
import {alertConfigurationRepository} from '../repositories/configuration';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const writer=(actor:AgentActor)=>{if(!['admin','operator'].includes(actor.role))throw new WorkflowError('只读用户不能评估或处理预警',403);};
type Row={id:string;datasetId:string;scopeKey:string;fingerprint:string;state:AlertVO['state'];active:boolean;version:number;note:string;hit:AlertVO;snapshot:AlertVO['snapshot'];createdAt:Date;updatedAt:Date};
const view=(r:Row):AlertVO=>({...r.hit,...r,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()});
export const alertService={
 async configuration(actor:AgentActor){return alertConfigurationRepository.get(actor);},
 async updateConfiguration(actor:AgentActor,input:AlertRulesUpdateDTO){return alertConfigurationRepository.update(actor,input);},
 async list(actor:AgentActor,activeOnly=false){return (await queryRows<Row>('SELECT * FROM operational_alert WHERE "organizationId"=$1 AND ($2::boolean=false OR (active AND state<>\'resolved\')) ORDER BY "createdAt" DESC LIMIT 100',[actor.organizationId,activeOnly])).map(view);},
 async get(actor:AgentActor,id:string){const r=await queryOne<Row>('SELECT * FROM operational_alert WHERE "organizationId"=$1 AND id=$2',[actor.organizationId,id]);if(!r)throw new WorkflowError('预警不存在',404);return view(r);},
 async evaluate(actor:AgentActor,input:AlertEvaluationDTO){
  writer(actor);const started=performance.now(),configuration=(await alertConfigurationRepository.get(actor)).current,snapshot=await operations.query(input.datasetId,{...input.scope,organizationId:actor.organizationId,authorizedCampusIds:[]});
  const {hits,skipped,outcomes}=evaluateRules(snapshot,configuration),computeDurationMs=Math.round((performance.now()-started)*100)/100,scopeKey=hash({datasetId:input.datasetId,startDate:input.scope.startDate,endDate:input.scope.endDate,campusIds:[...input.scope.campusIds].sort(),courseIds:[...input.scope.courseIds].sort(),channelIds:[...input.scope.channelIds].sort(),dataCutoff:input.scope.dataCutoff??null}),fingerprint=hash({metrics:snapshot.metrics,comparison:snapshot.comparison,batches:snapshot.batches,configuration});
  const alerts=await transaction(async client=>{
   // 同一范围串行评估；重复评估保留处理状态，新批次只保留最新有效命中。
   await queryOne('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.organizationId+scopeKey],client);
   await execute('UPDATE operational_alert SET active=false,"updatedAt"=NOW() WHERE "organizationId"=$1 AND "scopeKey"=$2',[actor.organizationId,scopeKey],client);
   const result:AlertVO[]=[];
   for(const hit of hits){const row=await queryOne<Row>(`INSERT INTO operational_alert (id,"organizationId","datasetId","scopeKey",fingerprint,rule,hit,snapshot,"createdBy") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT ("organizationId","scopeKey",fingerprint,rule) DO UPDATE SET active=true RETURNING *`,[randomUUID(),actor.organizationId,input.datasetId,scopeKey,fingerprint,hit.rule,JSON.stringify(hit),JSON.stringify(snapshot),actor.userId],client);result.push(view(row!));}
   return result;
  });return {alerts,skipped,snapshot,configuration,outcomes,computeDurationMs};
 },
 async replay(actor:AgentActor,input:AlertReplayDTO):Promise<AlertReplayResult>{
  const started=performance.now(),configuration=(await alertConfigurationRepository.get(actor)).current,prepared=await operations.prepare(input.datasetId,{...input.scope,organizationId:actor.organizationId,authorizedCampusIds:[]}),source=prepared.snapshot,loaded=performance.now();
  if(source.dataset.origin!=='simulated')throw new WorkflowError('历史经营预警回放仅支持独立模拟经营数据；学习和财务数据不可混算',400,'ALERT_REPLAY_MODE_MISMATCH');
  const cases:AlertReplayCase[]=[];
  for(const item of input.cases){
   const caseStarted=performance.now(),snapshot=await operations.queryPrepared(prepared,{...input.scope,startDate:item.startDate,endDate:item.endDate,organizationId:actor.organizationId,authorizedCampusIds:[]}),evaluation=evaluateRules(snapshot,configuration);
   cases.push({id:item.id,name:item.name,labelNote:item.labelNote,expected:item.expected??{},scope:snapshot.scope,hits:evaluation.hits,outcomes:evaluation.outcomes,computeDurationMs:Math.round((performance.now()-caseStarted)*100)/100,metrics:snapshot.metrics,batches:snapshot.batches,evidence:snapshot.metrics.flatMap(m=>m.evidence),sourceFingerprint:hash({scope:snapshot.scope,metrics:snapshot.metrics,comparison:snapshot.comparison,batches:snapshot.batches,configuration})});
  }
  return {datasetId:source.dataset.id,datasetName:source.dataset.name,origin:source.dataset.origin,generatedAt:new Date().toISOString(),configuration,cases,...summarizeReplay(cases),computeDurationMs:Math.round((performance.now()-started)*100)/100,dataLoadDurationMs:Math.round((loaded-started)*100)/100,manualTriggerWaitingMs:null,timingNote:'总耗时包含数据加载和计算；单场景耗时为计算耗时。回放由用户触发，无法测定异常出现到触发的人工等待时间，不将计算耗时表述为预警时效。',recordType:'demonstration'};
 },
 async update(actor:AgentActor,id:string,input:AlertUpdateDTO){writer(actor);const row=await queryOne<Row>(`UPDATE operational_alert SET state=$4,note=$5,version=version+1,"handledBy"=$6,"updatedAt"=NOW() WHERE id=$1 AND "organizationId"=$2 AND version=$3 AND active AND state<>'resolved' RETURNING *`,[id,actor.organizationId,input.version,input.state,input.note,actor.userId]);if(!row){await this.get(actor,id);throw new WorkflowError('预警版本已变化、已失效或已处理，请刷新',409);}return view(row);}
};

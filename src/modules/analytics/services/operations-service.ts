import {createHash} from 'node:crypto';
import type {EducationSnapshot} from '@/modules/education/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import {previousPeriod} from '../domain/period';
import {calculateOperations,operationalKinds} from '../domain/operations';
import {channelAttributionVersion} from '@/modules/education/contracts';
import type {OperationsRepository,PreparedOperations,DatabaseOperationResult} from '../repositories/operations-repository';
import type {OperationalAggregateInput} from '../domain/operations';
export interface EducationAnalysisPort {snapshot(org:string,id:string,kinds:readonly typeof operationalKinds[number][]):Promise<EducationSnapshot>;}
export class OperationsService {
 constructor(private education:EducationAnalysisPort,private repository?:OperationsRepository){}
 get usesDatabaseAggregation(){return !!this.repository;}
 async prepare(id:string,scope:AuthorizedScope):Promise<PreparedOperations>{return this.repository?this.repository.prepare(scope.organizationId,id):{snapshot:await this.education.snapshot(scope.organizationId,id,operationalKinds),organizationId:scope.organizationId};}
 async queryPreparedDetails(prepared:PreparedOperations,scope:AuthorizedScope):Promise<DatabaseOperationResult>{
  if(prepared.organizationId!==scope.organizationId)throw new Error('分析快照与机构不一致');
  if(!this.repository)throw new Error('当前分析端口未提供数据库聚合');
  return this.repository.summarize(prepared,scope);
 }
 async catalogPrepared(prepared:PreparedOperations,scope:AuthorizedScope){if(!this.repository)throw new Error('当前分析端口未提供数据库聚合');return this.repository.catalog(prepared,scope);}
 async queryPrepared(prepared:PreparedOperations,scope:AuthorizedScope,codes?:string[],compare=true){
  if(prepared.organizationId!==scope.organizationId)throw new Error('分析快照与机构不一致');
  if(!this.repository||prepared.snapshot.dataset.origin==='public')return this.fromSnapshot(prepared.snapshot,scope,codes,compare);
  const current=await this.repository.summarize(prepared,scope),result=this.fromSnapshot(current.snapshot,scope,codes,false,current.aggregate);
  if(compare){const before={...previousPeriod(scope),organizationId:scope.organizationId,authorizedCampusIds:scope.authorizedCampusIds,observationCutoff:scope.observationCutoff??scope.dataCutoff??prepared.snapshot.dataset.dataCutoff},prior=await this.repository.summarize(prepared,before),baseline=this.fromSnapshot(prior.snapshot,before,codes,false,prior.aggregate);this.attachComparison(result,baseline);}
  return result;
 }
 async query(id:string,scope:AuthorizedScope,codes?:string[],compare=true){
  if(this.repository)return this.queryPrepared(await this.prepare(id,scope),scope,codes,compare);
  const snapshot=await this.education.snapshot(scope.organizationId,id,operationalKinds);
  return this.fromSnapshot(snapshot,scope,codes,compare);
 }
 private attachComparison(result:ReturnType<typeof calculateOperations>,baseline:ReturnType<typeof calculateOperations>){result.comparison={scope:baseline.scope,metrics:baseline.metrics,changes:result.metrics.map(m=>{const p=baseline.metrics.find(p=>p.code===m.code);return {code:m.code,change:m.status==='ready'&&p?.status==='ready'&&m.value!==null&&p.value!==null?Math.round((m.value-p.value)*100)/100:null,unit:m.unit==='percent'?'个百分点':m.unit==='currency'?'元':'条',reason:!p||p.status!=='ready'||m.status!=='ready'?'本期或对比期数据不足，不计算变化':''};})};}
 fromSnapshot(snapshot:EducationSnapshot,scope:AuthorizedScope,codes?:string[],compare=true,aggregate?:OperationalAggregateInput){
  const id=snapshot.dataset.id;
  const result=calculateOperations(snapshot,scope,codes,aggregate);
  const stamp=(result:ReturnType<typeof calculateOperations>)=>{
  const sourceVersion=createHash('sha256').update(JSON.stringify({datasetId:id,schemaVersion:snapshot.dataset.schemaVersion,channelAttributionVersion,
   scope:{observationCutoff:scope.observationCutoff??scope.dataCutoff??snapshot.dataset.dataCutoff,startDate:result.scope.startDate,endDate:result.scope.endDate,dataCutoff:result.scope.dataCutoff,campusIds:[...result.scope.campusIds].sort(),courseIds:[...result.scope.courseIds].sort(),channelIds:[...result.scope.channelIds].sort()},
   batches:result.batches.map(b=>({id:b.id,kind:b.kind,rows:b.rows,hash:b.hash})).sort((a,b)=>a.id.localeCompare(b.id))
  })).digest('hex');
  // 计算器版本不足以区别两次导入；证据同时绑定数据批次和实际分析范围。
  for(const metric of result.metrics)metric.evidence=metric.evidence.map(e=>({...e,version:e.version+'/'+sourceVersion}));
  };
  stamp(result);
  if(compare){const baseline=calculateOperations(snapshot,{...previousPeriod(scope),organizationId:scope.organizationId,authorizedCampusIds:scope.authorizedCampusIds,observationCutoff:scope.observationCutoff??scope.dataCutoff??snapshot.dataset.dataCutoff},codes);stamp(baseline);result.comparison={scope:baseline.scope,metrics:baseline.metrics,changes:result.metrics.map(m=>{const p=baseline.metrics.find(p=>p.code===m.code);return {code:m.code,change:m.status==='ready'&&p?.status==='ready'&&m.value!==null&&p.value!==null?Math.round((m.value-p.value)*100)/100:null,unit:m.unit==='percent'?'个百分点':m.unit==='currency'?'元':'条',reason:!p||p.status!=='ready'||m.status!=='ready'?'本期或对比期数据不足，不计算变化':''};})};}
  return result;
 }
}

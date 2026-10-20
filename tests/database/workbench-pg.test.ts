import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {execute,queryOne,queryRows} from '@/platform/database';
import {readDecisionWorkbench} from '@/modules/decision/services/workbench';
import {readAgentWorkbench} from '@/modules/agent/services/workbench';
import {readKnowledgeWorkbench} from '@/modules/knowledge/services/workbench';
import {readReportWorkbench} from '@/modules/report/services/workbench';
import {readTagWorkbench} from '@/modules/tag/services/workbench';
import {readSegmentWorkbench} from '@/modules/segment/services/workbench';
import type {WorkbenchActor,WorkbenchReadOptions} from '@/shared/contracts/workbench';

// Only independent synthetic fixtures in the dedicated PostgreSQL test service.
// This file does not provision companies, touch ClickHouse or alter any schema.
const org=randomUUID(),foreign=randomUUID(),user=randomUUID(),other=randomUUID(),foreignUser=randomUUID();
const dataset=randomUUID(),learningDataset=randomUUID(),financeDataset=randomUUID(),foreignDataset=randomUUID();
const session=randomUUID(),otherSession=randomUUID(),foreignSession=randomUUID(),nullSession=randomUUID(),category=randomUUID(),legacyExpiryPlan=randomUUID();
const actor:WorkbenchActor={organizationId:org,userId:user,role:'admin'};
const options:WorkbenchReadOptions={today:'2026-10-18',todoLimit:200,recentLimit:6};
const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:['campus-a'],courseIds:['course-a'],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'};
const legacyScope={...scope,startDate:'2026-09-01',endDate:'2026-09-30',dataCutoff:'2026-09-30T15:59:59.999Z'};
const marker='forbidden-full-payload-'+randomUUID();
const ids={taskEarly:randomUUID(),taskLate:randomUUID(),taskReview:randomUUID(),taskFuture:randomUUID(),taskAssigned:randomUUID(),planExpired:randomUUID(),planPartial:randomUUID(),planInvalid:randomUUID(),planAdmin:randomUUID(),planDone:randomUUID(),planPrepared:randomUUID(),legacy:randomUUID(),legacyPublished:randomUUID(),materialDraft:randomUUID(),materialFailed:randomUUID(),materialOld:randomUUID(),materialReady:randomUUID(),tagDeleted:randomUUID(),tagActive:randomUUID(),segmentActive:randomUUID(),segmentDeleted:randomUUID()};
const reportIds:string[]=[];
let verified=false;
function testOnly(){const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test')throw Error('工作台夹具仅允许25432 education_cleanup_test专用库');}
const stamp=(index:number)=>new Date(Date.UTC(2026,9,17,0,index)).toISOString();
const future=new Date(Date.now()+60*60*1000).toISOString(),past=new Date(Date.now()-60*60*1000).toISOString();

async function task(id:string,state:string,dueDate:string,index:number,owner=user,creator=user,organizationId=org,datasetId=dataset){
 await execute(`INSERT INTO decision_task(id,"organizationId","datasetId",source,"sourceKey","sourceSnapshot",action,"ownerId","createdBy",priority,"dueDate","reviewMethod","recordType",state,"requestKey","requestHash","updatedAt") VALUES($1,$2,$3,'{}'::jsonb,$4,$5::jsonb,$6,$7,$8,'normal',$9,'人工核对','demonstration',$10,$11,'fixture',$12)`,[id,organizationId,datasetId,id,JSON.stringify({scope,answer:{internal:marker}}),'工作台测试任务 '+state,owner,creator,dueDate,state,randomUUID(),stamp(index)]);
}
async function proposal(id:string,status='draft',creator=user,organizationId=org,datasetId=dataset,selectedScope:unknown=scope,publishedTagId:string|null=null){
 await execute(`INSERT INTO education_risk_proposal(id,"organizationId","datasetId",name,scope,rule,status,preview,"publishedTagId","createdBy") VALUES($1,$2,$3,'工作台运营标签',$4::jsonb,$5::jsonb,$6,$7::jsonb,$8,$9)`,[id,organizationId,datasetId,JSON.stringify(selectedScope),JSON.stringify({internal:marker}),status,JSON.stringify({createdAt:past,members:[{internal:marker}]}),publishedTagId,creator]);
}
async function execution(plans:{id:string;status:string;expiresAt?:string;createdAt?:string}[],creator=user,sid=session,organizationId=org,proposals:unknown[]=[]){
 const id=randomUUID(),steps=[{context:{datasetId:dataset,scope}},{input:{secret:marker}},{context:{datasetId:learningDataset,scope:{courseKeys:['AAA_2014J'],relativeDayStart:-10,relativeDayEnd:20}}},...plans.map((p,index)=>({actionPlan:{...p,runId:id,version:index+1,datasetId:dataset,scope,updatedAt:stamp(index+20),steps:[{input:{internal:marker}}]}}))];
 await execute(`INSERT INTO agent_execution(id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,steps,proposals,answer,"deadlineAt") VALUES($1,$2,$3,$4,$5,'fixture','awaiting_confirmation',$6,$7::jsonb,$8::jsonb,$9::jsonb,NOW()-INTERVAL '1 hour')`,[id,organizationId,creator,sid,randomUUID(),marker,JSON.stringify(steps),JSON.stringify(proposals),JSON.stringify({internal:marker})]);
 return id;
}
async function material(id:string,family:string,version:number,creator:string,status:string,indexStatus:string,organizationId=org){
 await execute(`INSERT INTO knowledge_source_version(id,"logicalSourceId","organizationId",version,title,kind,content,"contentHash",status,"indexStatus","createdBy",period) VALUES($1,$2,$3,$4,'工作台材料','definition',$5,$6,$7,$8,$9,$10::jsonb)`,[id,family,organizationId,version,marker,'a'.repeat(64),status,indexStatus,creator,JSON.stringify({startDate:scope.startDate,endDate:scope.endDate})]);
}
async function report(id:string,index:number,creator=user,organizationId=org,datasetId=dataset,reportScope:unknown=scope){
 await execute(`INSERT INTO operational_report(id,"organizationId","createdBy","requestKey","requestHash","datasetId",kind,status,snapshot,facts,answer,"createdAt","deadlineAt") VALUES($1,$2,$3,$4,'fixture',$5,'weekly','generating',$6::jsonb,$7::jsonb,$8::jsonb,$9,NOW()-INTERVAL '1 hour')`,[id,organizationId,creator,randomUUID(),datasetId,JSON.stringify({scope:reportScope,evaluationContext:{inputs:[marker]}}),JSON.stringify([{internal:marker}]),JSON.stringify({internal:marker}),stamp(index)]);
}
async function snapshot(id:string,deleted:boolean,creator=user,organizationId=org,datasetId=dataset){
 const segmentId=randomUUID();await execute(`INSERT INTO segment(id,name,owned_by,created_by,entity_type,status,compute_type,is_deleted) VALUES($1,'工作台已保存人群',$2,$3,'STUDENT','ACTIVE','OFFLINE',$4)`,[segmentId,organizationId,creator,deleted]);
 await execute(`INSERT INTO education_segment_snapshot(id,"organizationId","segmentId","sourceTagId","tagVersion","datasetId",name,payload,"memberCount","createdBy") VALUES($1,$2,$3,$4,1,$5,'工作台已保存人群',$6::jsonb,1,$7)`,[id,organizationId,segmentId,randomUUID(),datasetId,JSON.stringify({scope,members:[{internal:marker}]}),creator]);
}

beforeAll(async()=>{
 testOnly();expect((await queryOne<{name:string}>('SELECT current_database() AS name'))?.name).toBe('education_cleanup_test');verified=true;
 for(const [id,organizationId]of [[user,org],[other,org],[foreignUser,foreign]])await execute(`INSERT INTO local_user(id,username,password_hash,real_name,role,organization_id) VALUES($1,$2,'synthetic-not-a-login','工作台夹具','admin',$3)`,[id,'workbench_'+id,organizationId]);
 for(const [id,organizationId,origin,analysisType]of [[dataset,org,'simulated','operations'],[learningDataset,org,'public','learning'],[financeDataset,org,'public','finance'],[foreignDataset,foreign,'simulated','operations']])await execute(`INSERT INTO education_dataset(id,"organizationId",key,name,origin,license,"schemaVersion","dataCutoff","analysisType") VALUES($1,$2,$3,$4,$5,'fixture','1',NOW(),$6)`,[id,organizationId,id,'工作台测试 '+analysisType,origin,analysisType]);
 for(const [id,organizationId,creator,datasetId]of [[session,org,user,dataset],[otherSession,org,other,dataset],[foreignSession,foreign,foreignUser,foreignDataset],[nullSession,org,user,dataset]])await execute(`INSERT INTO agent_session(id,"organizationId","createdBy",title,"datasetId",scope) VALUES($1,$2,$3,'工作台分析会话',$4,$5::jsonb)`,[id,organizationId,creator,datasetId,JSON.stringify(scope)]);
 await task(ids.taskEarly,'executing','2026-10-01',1);await task(ids.taskLate,'accepted','2026-10-05',2);await task(ids.taskReview,'review_pending','2026-10-20',3);await task(ids.taskFuture,'accepted','2026-10-21',4);
 for(const state of ['completed','deferred','rejected'])await task(randomUUID(),state,'2026-10-01',5);
 await task(ids.taskAssigned,'accepted','2026-10-01',6,other,user);await task(randomUUID(),'accepted','2026-10-01',7,other,other);await task(randomUUID(),'accepted','2026-10-01',8,foreignUser,foreignUser,foreign,foreignDataset);
 await execution([{id:ids.planExpired,status:'prepared',expiresAt:past}]);await execution([{id:ids.planPartial,status:'partially_failed',expiresAt:future}]);await execution([{id:ids.planInvalid,status:'invalid',expiresAt:future}]);await execution([{id:randomUUID(),status:'prepared'},{id:ids.planDone,status:'completed'}]);await execution([{id:randomUUID(),status:'prepared'},{id:ids.planPrepared,status:'prepared',expiresAt:future}]);
 await execution([{id:legacyExpiryPlan,status:'prepared',createdAt:past}]);
 await execution([{id:ids.planAdmin,status:'prepared',expiresAt:future}],user,otherSession);await execution([{id:randomUUID(),status:'prepared'}],other,otherSession);await execution([{id:randomUUID(),status:'prepared'}],foreignUser,foreignSession,foreign);
 await proposal(ids.legacy,'awaiting_confirmation',user,org,dataset,legacyScope);await execution([],user,session,org,[{id:ids.legacy,status:'awaiting_confirmation'}]);
 await proposal(ids.legacyPublished,'published');await execution([],user,session,org,[{id:ids.legacyPublished,status:'awaiting_confirmation'}]);
 for(const [index,value]of [[0,[null,'historical-step',3,{}, {actionPlan:null}]],[1,null]] as const)await execute(`INSERT INTO agent_execution(id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,steps,proposals,"startedAt","deadlineAt") VALUES($1,$2,$3,$4,$5,'fixture','awaiting_confirmation','历史空字段',$6::jsonb,$6::jsonb,NOW()+$7*INTERVAL '1 second',NOW()-INTERVAL '1 hour')`,[randomUUID(),org,user,nullSession,randomUUID(),JSON.stringify(value),index]);
 await material(ids.materialDraft,randomUUID(),1,user,'draft','pending');await material(ids.materialFailed,randomUUID(),1,user,'approved','failed');
 const family=randomUUID();await material(ids.materialOld,family,1,user,'draft','pending');await material(randomUUID(),family,2,other,'approved','ready');
 const readyFamily=randomUUID();await material(randomUUID(),readyFamily,1,user,'approved','failed');await material(ids.materialReady,readyFamily,2,user,'approved','ready');
 await material(randomUUID(),randomUUID(),1,other,'draft','pending');await material(randomUUID(),randomUUID(),1,foreignUser,'draft','pending',foreign);
 for(let index=0;index<7;index++){const id=randomUUID();reportIds.push(id);await report(id,index);}
 await report(randomUUID(),9,other);await report(randomUUID(),10,foreignUser,foreign,foreignDataset);await report(randomUUID(),11,user,org,financeDataset,{years:[2024,2025]});
 await execute(`INSERT INTO tag_category(id,name,owned_by,path,created_by) VALUES($1,'工作台标签测试',$2,$3,$4)`,[category,org,category,user]);
 for(const [id,deleted]of [[ids.tagActive,false],[ids.tagDeleted,true]])await execute(`INSERT INTO tag(id,name,owned_by,value_type,category_id,created_by,is_deleted) VALUES($1,'工作台标签',$2,'BOOLEAN',$3,$4,$5)`,[id,org,category,user,deleted]);
 await proposal(randomUUID(),'published',user,org,dataset,scope,ids.tagActive);await proposal(randomUUID(),'published',user,org,dataset,scope,ids.tagDeleted);await proposal(randomUUID(),'draft',other);await proposal(randomUUID(),'draft',foreignUser,foreign,foreignDataset);
 await snapshot(ids.segmentActive,false);await snapshot(ids.segmentDeleted,true);await snapshot(randomUUID(),false,other);await snapshot(randomUUID(),false,foreignUser,foreign,foreignDataset);
});
afterAll(async()=>{
 if(!verified)return;testOnly();const organizations=[org,foreign];
 // Clean up only this file's random organizations, in dependency order; never truncate.
 for(const table of ['decision_feedback','decision_task','agent_message','agent_execution','agent_session','knowledge_source_version','operational_report','education_segment_snapshot','education_risk_proposal'])await execute(`DELETE FROM ${table} WHERE "organizationId"=ANY($1::uuid[])`,[organizations]);
 await execute('DELETE FROM segment WHERE owned_by=ANY($1::uuid[])',[organizations]);await execute('DELETE FROM tag WHERE owned_by=ANY($1::uuid[])',[organizations]);await execute('DELETE FROM tag_category WHERE id=$1',[category]);await execute('DELETE FROM education_dataset WHERE "organizationId"=ANY($1::uuid[])',[organizations]);await execute('DELETE FROM local_user WHERE id=ANY($1::uuid[])',[[user,other,foreignUser]]);
});

describe('独立工作台轻量元数据及本人归属（真实PostgreSQL）',()=>{
 it('仅本人负责的三个活跃任务状态进入待办，逾期先按期限、再待复核排序，数量不受读取上限影响',async()=>{
  const result=await readDecisionWorkbench(actor,options);expect(result.count).toBe(4);expect(result.todos.map(item=>item.id)).toEqual([ids.taskEarly,ids.taskLate,ids.taskReview,ids.taskFuture]);expect(result.todos[0].overdue).toBe(true);expect(result.todos[2].overdue).toBe(false);expect(result.recent.some(item=>item.id===ids.taskAssigned)).toBe(true);
  const limited=await readDecisionWorkbench(actor,{...options,todoLimit:2});expect(limited.count).toBe(4);expect(limited.todos).toHaveLength(2);
 });
 it('同run只计最新方案，最新完成时不回退旧方案，管理员本人在他人会话中准备也纳入',async()=>{
  const result=await readAgentWorkbench(actor,options);expect(result.count).toBe(7);expect(result.todos.map(item=>item.id)).toEqual(expect.arrayContaining([ids.planExpired,ids.planPartial,ids.planInvalid,ids.planPrepared,ids.planAdmin,ids.legacy,legacyExpiryPlan]));expect(result.todos.some(item=>item.id===ids.planDone||item.id===ids.legacyPublished)).toBe(false);expect(result.recent.every(item=>[session,nullSession].includes(new URL(item.href,'http://test').searchParams.get('sessionId')!))).toBe(true);
 });
 it('过期、部分失败及旧草稿恢复明确；旧草稿使用真实草稿的范围，不借用最后学习context',async()=>{
  const result=await readAgentWorkbench(actor,options),expired=result.todos.find(item=>item.id===ids.planExpired)!,partial=result.todos.find(item=>item.id===ids.planPartial)!,legacy=result.todos.find(item=>item.id===ids.legacy)!;
  expect(expired.statusLabel).toBe('需要重新准备');expect(partial.actionLabel).toBe('继续处理');expect(legacy.statusLabel).toBe('需要重新准备');const url=new URL(legacy.href,'http://test');expect(url.searchParams.get('datasetId')).toBe(dataset);expect(JSON.parse(url.searchParams.get('scope')!).startDate).toBe('2026-09-01');expect(url.searchParams.has('learningScope')).toBe(false);
 });
 it('旧方案缺少expiresAt时按createdAt加30分钟；JSON空值与非对象步骤不破坏待办或最近会话读取',async()=>{
  const result=await readAgentWorkbench(actor,options),old=result.todos.find(item=>item.id===legacyExpiryPlan)!;expect(result.count).toBe(7);expect(old.statusLabel).toBe('需要重新准备');expect(Date.parse(old.expiresAt!)).toBe(Date.parse(past)+30*60*1000);expect(old.actionLabel).toBe('重新准备');const empty=result.recent.find(item=>item.id===nullSession)!;expect(empty).toBeDefined();expect(new URL(empty.href,'http://test').searchParams.get('datasetId')).toBe(dataset);expect(result.recent).toHaveLength(2);expect((await queryOne<{status:string}>(`SELECT status FROM agent_execution WHERE "sessionId"=$1 ORDER BY "startedAt" DESC LIMIT 1`,[nullSession]))?.status).toBe('awaiting_confirmation');
 });
 it('材料按真正最新版本再筛创建者，准备失败可恢复，旧草稿不会误计待审',async()=>{
  const result=await readKnowledgeWorkbench(actor,options);expect(result.count).toBe(2);expect(result.todos.map(item=>item.id).sort()).toEqual([ids.materialDraft,ids.materialFailed].sort());expect(result.recent.some(item=>item.id===ids.materialOld)).toBe(false);expect(result.recent.some(item=>item.id===ids.materialReady)).toBe(true);expect(result.todos.find(item=>item.id===ids.materialFailed)?.actionLabel).toBe('重新准备');
 });
 it('报告按真实保存时间限6条，过期生成记录只读不改状态，财务链接独立保留年度范围',async()=>{
  const result=await readReportWorkbench(actor,options);expect(result.recent).toHaveLength(6);const finance=result.recent[0];expect(finance.dataset?.analysisType).toBe('finance');const url=new URL(finance.href,'http://test');expect(JSON.parse(url.searchParams.get('financeScope')!).years).toEqual([2024,2025]);expect(url.searchParams.has('scope')).toBe(false);expect((await queryOne<{status:string}>('SELECT status FROM operational_report WHERE id=$1',[reportIds[0]]))?.status).toBe('generating');
 });
 it('标签和人群只返回本人元数据，软删除主记录不再显示且不读取冻结成员',async()=>{
  const tags=await readTagWorkbench(actor,{...options,recentLimit:100}),segments=await readSegmentWorkbench(actor,options);expect(tags.recent.every(item=>!item.href.includes(ids.tagDeleted))).toBe(true);expect((await queryRows<{id:string}>(`SELECT id FROM education_risk_proposal WHERE "publishedTagId"=$1`,[ids.tagDeleted])).every(row=>!tags.recent.some(item=>item.id===row.id))).toBe(true);expect(segments.recent.map(item=>item.id)).toEqual([ids.segmentActive]);expect(segments.recent[0].href).toContain('snapshotId='+ids.segmentActive);
 });
 it('六模块的外机构、同机构其他账号及只读角色被分别约束，不泄露内部正文',async()=>{
  const reads=[readDecisionWorkbench,readAgentWorkbench,readKnowledgeWorkbench,readReportWorkbench,readTagWorkbench,readSegmentWorkbench];
  for(const read of reads){const own=await read(actor,{...options,recentLimit:100}),view=await read({...actor,role:'viewer'},{...options,recentLimit:100}),alien=await read({organizationId:foreign,userId:user,role:'admin'},options);expect(JSON.stringify(own)).not.toContain(marker);expect(view.todos.every(item=>!item.canAct&&item.actionLabel==='查看')).toBe(true);expect(alien.count).toBe(0);expect(alien.todos).toEqual([]);expect(alien.recent).toEqual([]);}
 });
});

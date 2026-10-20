import {randomUUID} from 'node:crypto';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const database=vi.hoisted(()=>({queryOne:vi.fn(),execute:vi.fn(),transaction:vi.fn(async fn=>fn({query:vi.fn()}))}));
vi.mock('@/platform/database',()=>database);
import {DatabaseActionPlanStore} from '@/modules/agent/services/action-store';
import type {ActionPlanVO} from '@/modules/agent/contracts/actions';
import type {AgentActor} from '@/modules/agent/contracts';
const actor:AgentActor={userId:randomUUID(),organizationId:randomUUID(),role:'operator'},runId=randomUUID(),datasetId=randomUUID(),scope={organizationId:actor.organizationId,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
const plan=():ActionPlanVO=>({id:randomUUID(),version:1,runId,datasetId,scope,status:'prepared',steps:[],evidence:[],sourceFingerprint:'fingerprint',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const row=(steps:unknown[]=[])=>({id:runId,sessionId:randomUUID(),createdBy:actor.userId,status:'completed',datasetId,scope,answer:null,evidence:[],proposals:[],steps});
beforeEach(()=>vi.clearAllMocks());
describe('操作计划JSONB持久化',()=>{
 it('读取来源同时限定公司与执行编号，优先使用每轮冻结上下文',async()=>{
  const frozen={...scope,courseIds:['original-course']};database.queryOne.mockResolvedValue({...row(),scope:{...scope,courseIds:['changed-session']},steps:[{id:'context',tool:'resolve_context',status:'completed',evidence:[],context:{datasetId,scope:frozen}}]});
  const result=await new DatabaseActionPlanStore().get(actor,runId);expect(result.context.scope).toEqual(frozen);expect(database.queryOne.mock.calls[0][1]).toEqual([runId,actor.organizationId]);expect(database.queryOne.mock.calls[0][0]).toContain('e."organizationId"=$2::uuid');
 });
 it('兼容旧确认入口追加计划，行锁保护且同计划编号幂等',async()=>{
  const store=new DatabaseActionPlanStore(),p=plan();database.queryOne.mockResolvedValueOnce(row());await store.append(actor,runId,p);expect(database.queryOne.mock.calls[0][0]).toContain('FOR UPDATE OF e');const stored=JSON.parse(database.execute.mock.calls[0][1][2]);expect(stored[0]).toMatchObject({tool:'prepare_action_plan',actionPlan:{id:p.id,version:1}});
  database.execute.mockClear();database.queryOne.mockResolvedValueOnce(row(stored));expect((await store.append(actor,runId,p)).id).toBe(p.id);expect(database.execute).not.toHaveBeenCalled();
 });
 it('不能修改其他账号的计划或用旧卡覆盖更新计划',async()=>{
  const p=plan(),latest=plan(),store=new DatabaseActionPlanStore();database.queryOne.mockResolvedValueOnce({...row([{actionPlan:p}]),createdBy:randomUUID()});await expect(store.mutate(actor,runId,p.id,current=>{current.version++;})).rejects.toMatchObject({code:'PLAN_READ_ONLY'});
  database.queryOne.mockResolvedValueOnce(row([{actionPlan:p},{actionPlan:latest}]));await expect(store.mutate(actor,runId,p.id,current=>{current.version++;})).rejects.toMatchObject({code:'PLAN_SUPERSEDED'});expect(database.execute).not.toHaveBeenCalled();
 });
 it('只读用户即使直接调用仓储也不能改写计划',async()=>{
  await expect(new DatabaseActionPlanStore().mutate({...actor,role:'viewer'},runId,randomUUID(),()=>{})).rejects.toMatchObject({code:'FORBIDDEN_TOOL'});expect(database.transaction).not.toHaveBeenCalled();
 });
});

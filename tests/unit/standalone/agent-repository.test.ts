import {beforeEach,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {AgentActor,AgentRunVO,AgentProposalVO} from '@/modules/agent/contracts';
const database=vi.hoisted(()=>({execute:vi.fn(),queryOne:vi.fn(),queryRows:vi.fn(),transaction:vi.fn()}));
vi.mock('@/platform/database',()=>database);
import {DatabaseAgentRepository} from '@/modules/agent/repositories/repository';
const org=randomUUID(),creator=randomUUID(),other=randomUUID(),sessionId=randomUUID(),runId=randomUUID();
const actor:AgentActor={userId:other,organizationId:org,role:'viewer'};
const now=new Date(),scope={organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
const session=()=>({id:sessionId,organizationId:org,createdBy:creator,title:'出勤分析',datasetId:randomUUID(),scope,createdAt:now,updatedAt:now});
const record=(status='running',proposals:AgentProposalVO[]=[])=>({id:runId,organizationId:org,createdBy:creator,sessionId,requestKey:randomUUID(),requestHash:'hash',status,message:'问题',answer:null,steps:[],proposals,evidence:[],errorCode:null,errorMessage:null,startedAt:now,deadlineAt:new Date(now.getTime()+120000),completedAt:null});
const run=(status:AgentRunVO['status']='completed',proposals:AgentProposalVO[]=[]):AgentRunVO=>({id:runId,sessionId,status,steps:[],proposals,evidence:[],answer:null,errorCode:null,errorMessage:null,startedAt:now.toISOString(),completedAt:now.toISOString()});
const proposal=(id:string,status:AgentProposalVO['status']):AgentProposalVO=>({id,kind:'tag',version:1,status,name:'风险',estimatedCount:1,previewToken:randomUUID(),previewFingerprint:'a'.repeat(64),publishedTagId:status==='published'?randomUUID():null,evidence:[]});
const updates=()=>database.execute.mock.calls.filter(([sql])=>sql.startsWith('UPDATE agent_execution'));
beforeEach(()=>{
 vi.clearAllMocks();database.transaction.mockImplementation(async(work:(client:unknown)=>Promise<unknown>)=>work({query:vi.fn()}));
 database.execute.mockResolvedValue(1);database.queryOne.mockResolvedValue(null);database.queryRows.mockResolvedValue([]);
});
describe('Agent仓储机构隔离和终态防覆盖',()=>{
 it('viewer读取同机构会话，返回只读标志；admin可继续',async()=>{
  database.queryRows.mockResolvedValue([session()]);const repository=new DatabaseAgentRepository();
  expect((await repository.listSessions(actor))[0]).toMatchObject({createdBy:creator,editable:false});
  expect(database.queryRows.mock.calls[0][0]).toContain('"organizationId"=$1::uuid');expect(database.queryRows.mock.calls[0][1]).toEqual([org]);
  expect((await repository.listSessions({...actor,role:'admin'}))[0].editable).toBe(true);
 });
 it('执行读取按机构过滤，不因viewer不是创建者而隐藏结果',async()=>{
  database.queryOne.mockResolvedValueOnce(record()).mockResolvedValueOnce(session());
  expect((await new DatabaseAgentRepository().getRun(actor,runId)).run.id).toBe(runId);
  expect(database.queryOne.mock.calls[0][1]).toEqual([runId,org]);expect(database.queryOne.mock.calls[0][0]).toContain('"organizationId"=$2::uuid');
 });
 it('operator不能继续他人会话',async()=>{
  database.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(session());
  await expect(new DatabaseAgentRepository().prepare({...actor,role:'operator'},{sessionId,message:'继续',requestKey:randomUUID()},'hash')).rejects.toMatchObject({code:'SESSION_READ_ONLY',status:403});
  expect(database.queryOne.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO agent_execution'))).toBe(false);
 });
 it('重复请求复用结果；相同幂等键不能换问题',async()=>{
  const old=record();database.queryOne.mockResolvedValueOnce(old).mockResolvedValueOnce(session());
  const repository=new DatabaseAgentRepository(),input={sessionId,message:'问题',requestKey:old.requestKey};
  expect((await repository.prepare(actor,input,'hash')).reused).toBe(true);
  database.queryOne.mockResolvedValueOnce(old);await expect(repository.prepare(actor,input,'other')).rejects.toMatchObject({code:'REQUEST_KEY_CONFLICT',status:409});
 });
 it('失败终态不能被迟到的成功覆盖',async()=>{
  database.queryOne.mockResolvedValue(record('failed'));
  expect(await new DatabaseAgentRepository().finish(actor,run('completed'))).toBe(false);expect(updates()).toHaveLength(0);
  expect(database.execute.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO agent_message'))).toBe(false);
 });
 it('reader可将本机构过期running转为失败，只更新预期状态',async()=>{
  database.queryOne.mockResolvedValueOnce(record()).mockResolvedValueOnce(null);const failed=run('failed');failed.errorCode='EXECUTION_EXPIRED';failed.errorMessage='执行已中断';
  expect(await new DatabaseAgentRepository().finish(actor,failed)).toBe(true);
  expect(updates()[0][0]).toContain('status=ANY($11::text[])');expect(updates()[0][1][10]).toEqual(['running']);expect(updates()[0][1].slice(0,3)).toEqual([runId,org,'failed']);
 });
 it('同时确认不同草稿时保留已发布结果，不退回待确认',async()=>{
  const first=proposal(randomUUID(),'published'),second=proposal(randomUUID(),'awaiting_confirmation');
  database.queryOne.mockResolvedValueOnce(record('awaiting_confirmation',[first,second])).mockResolvedValueOnce(null);
  const stale=run('awaiting_confirmation',[{...first,status:'awaiting_confirmation',publishedTagId:null},{...second,status:'published',publishedTagId:randomUUID()}]);
  expect(await new DatabaseAgentRepository().finish({...actor,role:'operator'},stale,['awaiting_confirmation','completed'])).toBe(true);
  expect(stale.status).toBe('completed');expect(stale.proposals.every(p=>p.status==='published')).toBe(true);
  expect(JSON.parse(updates()[0][1][4])[0].publishedTagId).toBe(first.publishedTagId);
 });
 it('步骤保存只允许当前执行者写入running，不覆盖终态',async()=>{
  await new DatabaseAgentRepository().save({...actor,role:'operator'},run('running'));
  expect(updates()[0][0]).toContain('"createdBy"=$12::uuid');expect(updates()[0][1][11]).toBe(other);expect(updates()[0][1][10]).toEqual(['running']);
  database.execute.mockResolvedValueOnce(0);await expect(new DatabaseAgentRepository().save(actor,run('running'))).rejects.toMatchObject({code:'EXECUTION_ENDED'});
 });
});


import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {decisionArrangementMatches,decisionUpdateSchema,type DecisionCreate,type DecisionTask} from '@/modules/decision/contracts';
const mocks=vi.hoisted(()=>({one:vi.fn(),rows:vi.fn(),execute:vi.fn(),transaction:vi.fn(),run:vi.fn(),session:vi.fn(),inspect:vi.fn()}));
vi.mock('@/platform/database',()=>({queryOne:mocks.one,queryRows:mocks.rows,execute:mocks.execute,transaction:mocks.transaction}));
vi.mock('@/modules/agent/server',()=>({agentService:{getRun:mocks.run,getSession:mocks.session}}));
vi.mock('@/modules/report/server',()=>({reportService:{}}));
vi.mock('@/modules/education/server',()=>({educationData:{inspect:mocks.inspect}}));
vi.mock('@/modules/segment/server',()=>({riskSegments:{}}));
vi.mock('@/modules/decision/services/review',()=>({calculateDecisionReview:vi.fn(),completedBatchSignature:vi.fn()}));
import {decisionService} from '@/modules/decision/services/service';
const org='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003',runId='00000000-0000-4000-8000-000000000004',requestKey='00000000-0000-4000-8000-000000000005';
const actor={organizationId:org,userId:user,role:'operator'},scope={organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
const base:DecisionCreate={source:{kind:'agent',id:runId,index:0},requestKey,disposition:'accepted',action:'逐一核查缺勤原因',ownerId:user,priority:'normal',dueDate:'2026-10-31',reviewMethod:'核对后续签到',recordType:'demonstration'};
function row(changes:Partial<DecisionTask>={}){return {id,datasetId:id,source:base.source,sourceSnapshot:{key:'agent:'+runId+':0',source:base.source,datasetId:id,scope},action:base.action,ownerId:user,ownerName:'测试运营',createdBy:user,priority:base.priority,dueDate:base.dueDate,reviewMethod:base.reviewMethod,segmentSnapshotId:null,recordType:'demonstration',goals:null,state:'accepted',version:1,createdAt:new Date(),updatedAt:new Date(),requestKey:'old-key',requestHash:'old-hash',...changes};}
let current:ReturnType<typeof row>;
beforeEach(()=>{
 vi.clearAllMocks();current=row();mocks.transaction.mockImplementation(async(fn:(client:unknown)=>Promise<unknown>)=>fn({test:true}));
 mocks.rows.mockImplementation(async(sql:string)=>sql.includes('FROM local_user')?[{id:user,name:'测试运营'}]:[]);
 mocks.one.mockImplementation(async(sql:string)=>sql.includes('FROM local_user')?{id:user}:sql.includes('FROM decision_feedback')?null:sql.includes('FROM decision_task')?structuredClone(current):null);
 mocks.execute.mockResolvedValue(1);
 const answer={summary:'需核查',facts:[{id:'attendance',label:'出勤率',value:70,unit:'%',status:'ready',numerator:70,denominator:100,evidenceIds:['e']}],hypotheses:[],recommendations:['逐一核查缺勤原因'],limitations:[]};
 mocks.run.mockResolvedValue({id:runId,sessionId:runId,status:'completed',answer,evidence:[{id:'e',kind:'metric',sourceId:id,version:'v1',summary:'核验依据',updatedAt:'2026-08-31T00:00:00Z'}],completedAt:'2026-09-01T00:00:00Z',context:{datasetId:id,scope}});mocks.session.mockResolvedValue({session:{datasetId:id,scope}});mocks.inspect.mockResolvedValue({dataset:{id,origin:'simulated',key:'simulation',analysisType:'operations'}});
});
describe('决策任务来源复用及安排编辑',()=>{
 it('相同安排按实际字段复用，JSONB键序不制造冲突，缺失目标不能覆盖旧目标',()=>{
  const targets=[{code:'attendance_rate' as const,operator:'at_least' as const,target:80}],period={mode:'operations' as const,startDate:'2026-11-01',endDate:'2026-11-30'},goals={targets,reviewPeriod:period,setAt:'2026-10-10T00:00:00Z',setBy:user,version:'decision-goals-v1' as const};
  expect(decisionArrangementMatches({...current,goals},{...base,goals:{targets:[{target:80,operator:'at_least',code:'attendance_rate'}],reviewPeriod:{endDate:period.endDate,mode:period.mode,startDate:period.startDate}}},user)).toBe(true);expect(decisionArrangementMatches({...current,goals},base,user)).toBe(false);expect(decisionArrangementMatches(current,{...base,dueDate:'2026-11-01'},user)).toBe(false);
 });
 it('来源查重只读并带当前机构过滤，不获取其他公司的任务',async()=>{
  expect((await decisionService.existing(actor,base.source))?.id).toBe(id);expect(mocks.one.mock.calls[0][0]).toContain('"organizationId"=$1 AND "sourceKey"=$2');expect(mocks.one.mock.calls[0][1]).toEqual([org,'agent:'+runId+':0']);expect(mocks.execute).not.toHaveBeenCalled();
 });
 it('正式创建在来源锁内重新核验安排，竞争出现不同安排不复用也不写新任务',async()=>{
  current=row({dueDate:'2026-11-05'});await expect(decisionService.create(actor,base)).rejects.toMatchObject({code:'DECISION_SOURCE_CONFLICT'});expect(mocks.execute.mock.calls[0][0]).toContain('pg_advisory_xact_lock');expect(mocks.execute.mock.calls.some(c=>String(c[0]).includes('INSERT INTO'))).toBe(false);
 });
 it('正式创建可复用完全相同来源与安排，不新增反馈或重置状态',async()=>{
  current=row({state:'executing'});const saved=await decisionService.create(actor,base);expect(saved.state).toBe('executing');expect(mocks.execute.mock.calls.some(c=>String(c[0]).includes('INSERT INTO'))).toBe(false);
 });
 it('待执行安排按版本更新并保留前后记录，不更改来源、人群和状态',async()=>{
  const arrangement={action:'电话核查后安排补课',ownerId:user,priority:'high' as const,dueDate:'2026-11-05',reviewMethod:'核查补课签到'},input={requestKey,expectedVersion:1,kind:'adoption' as const,note:'确认调整期限',arrangement};await decisionService.update(actor,id,input);
  const change=mocks.execute.mock.calls.find(c=>String(c[0]).includes('SET action='));expect(change?.[1]).toEqual([id,org,arrangement.action,user,'high',arrangement.dueDate,arrangement.reviewMethod,2]);const feedback=mocks.execute.mock.calls.find(c=>String(c[0]).includes('INSERT INTO decision_feedback'));expect(feedback?.[1][6]).toContain('安排调整前');expect(feedback?.[1][6]).toContain('逐一核查缺勤原因');expect(feedback?.[1][6]).toContain('调整后');expect(mocks.one.mock.calls.some(c=>String(c[0]).includes('FROM local_user')&&String(c[0]).includes('FOR SHARE'))).toBe(true);
 });
 it('开始执行、过期版本、非所属任务和非本机构责任人都拒绝安排写入',async()=>{
  const input={requestKey,expectedVersion:1,kind:'adoption' as const,note:'修改安排',arrangement:{action:base.action,ownerId:user,priority:'normal' as const,dueDate:'2026-11-05',reviewMethod:base.reviewMethod}};
  current=row({state:'executing'});await expect(decisionService.update(actor,id,input)).rejects.toMatchObject({code:'TASK_ALREADY_STARTED'});
  current=row({version:2});await expect(decisionService.update(actor,id,input)).rejects.toThrow('已被更新');
  current=row({ownerId:org,createdBy:org});await expect(decisionService.update(actor,id,input)).rejects.toThrow('只能更新');
  current=row();await expect(decisionService.update(actor,id,{...input,arrangement:{...input.arrangement,ownerId:org}})).rejects.toThrow('只能分配给自己');expect(mocks.execute.mock.calls.some(c=>String(c[0]).includes('UPDATE'))).toBe(false);
 });
 it('安排编辑严格拒绝伪造公司、来源、执行状态组合和只读账号',async()=>{
  const input={requestKey,expectedVersion:1,kind:'adoption',note:'修改安排',arrangement:{action:base.action,ownerId:user,priority:'normal',dueDate:'2026-11-05',reviewMethod:base.reviewMethod}};expect(decisionUpdateSchema.safeParse({...input,state:'executing'}).success).toBe(false);expect(decisionUpdateSchema.safeParse({...input,arrangement:{...input.arrangement,organizationId:org}}).success).toBe(false);expect(decisionUpdateSchema.safeParse({...input,source:base.source}).success).toBe(false);await expect(decisionService.update({...actor,role:'viewer'},id,decisionUpdateSchema.parse(input))).rejects.toThrow('只读');expect(mocks.execute).not.toHaveBeenCalled();
 });
 it('已成功保存的安排请求重复提交即使任务已执行也返回原对象，不追加反馈',async()=>{
  const input={requestKey,expectedVersion:1,kind:'adoption' as const,note:'修改安排',arrangement:{action:base.action,ownerId:user,priority:'normal' as const,dueDate:'2026-11-05',reviewMethod:base.reviewMethod}},digest=createHash('sha256').update(JSON.stringify(input)).digest('hex'),original=mocks.one.getMockImplementation()!;current=row({state:'executing',version:3});mocks.one.mockImplementation(async(sql:string,...args:unknown[])=>sql.includes('FROM decision_feedback')?{requestHash:digest}:original(sql,...args));
  expect((await decisionService.update(actor,id,input)).state).toBe('executing');expect(mocks.execute).not.toHaveBeenCalled();expect(mocks.transaction).not.toHaveBeenCalled();
 });
});

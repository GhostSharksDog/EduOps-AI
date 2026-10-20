import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/modules/decision/server',()=>({readDecisionWorkbench:vi.fn()}));
vi.mock('@/modules/agent/server',()=>({readAgentWorkbench:vi.fn()}));
vi.mock('@/modules/knowledge/server',()=>({readKnowledgeWorkbench:vi.fn()}));
vi.mock('@/modules/report/server',()=>({readReportWorkbench:vi.fn()}));
vi.mock('@/modules/tag/server',()=>({readTagWorkbench:vi.fn()}));
vi.mock('@/modules/segment/server',()=>({readSegmentWorkbench:vi.fn()}));
import {queryWorkbench,type WorkbenchReaders} from '@/modules/overview/services/workbench-service';
import {workbenchRecordLink,workbenchPeriod} from '@/shared/lib/workbench-record';
import {workbenchQuerySchema,type WorkbenchItem,type WorkbenchSourceData} from '@/shared/contracts/workbench';

const actor={organizationId:'company-a',userId:'user-a',role:'operator'},now=new Date('2026-10-18T02:00:00Z');
const item=(id:string,kind:WorkbenchItem['kind'],part:Partial<WorkbenchItem>={}):WorkbenchItem=>({id,kind,title:id,status:'prepared',statusLabel:'待处理',updatedAt:'2026-10-18T00:00:00Z',href:'/dashboard/agent?runId='+id,actionLabel:'查看',canAct:false,...part});
const source=(todos:WorkbenchItem[]=[],recent:WorkbenchItem[]=[],count=todos.length):WorkbenchSourceData=>({count,todos,recent});
function readers():WorkbenchReaders{return Object.fromEntries(['task','agent','material','report','tag','segment'].map(key=>[key,vi.fn(async()=>source())])) as unknown as WorkbenchReaders;}
describe('个人工作台聚合',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('跨来源按逾期、待复核、更新时间排序，分页不漏项且计数独立于分页',async()=>{
  const read=readers(),tasks=[item('late-new','task',{status:'accepted',dueDate:'2026-10-17'}),item('late-old','task',{status:'executing',dueDate:'2026-10-10'}),item('review','task',{status:'review_pending',dueDate:'2026-10-20'})];
  const plans=Array.from({length:12},(_,i)=>item('plan-'+String(i).padStart(2,'0'),'plan',{updatedAt:new Date(now.getTime()-i*1000).toISOString()}));
  read.task=vi.fn(async()=>source(tasks));read.agent=vi.fn(async()=>source(plans));
  const first=await queryWorkbench({type:'all',page:1},actor,{readers:read,now});
  expect(first.counts).toEqual({all:15,task:3,plan:12,material:0});expect(first.todos.total).toBe(15);
  expect(first.todos.items.slice(0,3).map(x=>x.id)).toEqual(['late-old','late-new','review']);
  const next=await queryWorkbench({type:'all',page:2},actor,{readers:read,now});
  expect(next.todos.items).toHaveLength(5);expect(new Set([...first.todos.items,...next.todos.items].map(x=>x.id)).size).toBe(15);
  const filtered=await queryWorkbench({type:'plan',page:1},actor,{readers:read,now});expect(filtered.todos.total).toBe(12);expect(filtered.todos.items.every(x=>x.kind==='plan')).toBe(true);
  for(const readSource of Object.values(read))expect(readSource).toHaveBeenCalledWith(actor,expect.objectContaining({today:'2026-10-18',recentLimit:6}));
 });
 it('部分来源失败保留已取得记录，未知数量不补零且不返回内部异常',async()=>{
  const read=readers();read.task=async()=>{throw new Error('private-connection-secret');};read.agent=async()=>source([item('p','plan')],[item('a','analysis')]);
  const result=await queryWorkbench({type:'all',page:1},actor,{readers:read,now});
  expect(result.counts.task).toBeNull();expect(result.counts.all).toBeNull();expect(result.todos.status).toBe('partial');expect(result.todos.items[0].id).toBe('p');
  expect(result.recent.status).toBe('partial');expect(JSON.stringify(result)).not.toContain('private-connection-secret');
  const filtered=await queryWorkbench({type:'plan',page:1},actor,{readers:read,now});expect(filtered.todos.status).toBe('ready');expect(filtered.todos.total).toBe(1);
 });
 it('全部来源失败展示错误而不是空待办',async()=>{
  const read=readers();for(const key of Object.keys(read) as (keyof WorkbenchReaders)[])read[key]=async()=>{throw Error('unavailable');};
  const result=await queryWorkbench({type:'all',page:1},actor,{readers:read,now});expect(result.todos.status).toBe('error');expect(result.recent.status).toBe('error');expect(result.todos.total).toBeNull();
 });
 it('最近工作按实际时间排序、同类编号去重、总数最多六条',async()=>{
  const read=readers();read.task=async()=>source([],Array.from({length:6},(_,i)=>item('task-'+i,'task',{updatedAt:'2026-10-17T00:00:00Z'})));
  read.agent=async()=>source([],[item('new','analysis',{updatedAt:'2026-10-18T01:00:00Z'}),item('new','analysis')]);
  const result=await queryWorkbench({type:'all',page:1},actor,{readers:read,now});expect(result.recent.items).toHaveLength(6);expect(result.recent.items[0].id).toBe('new');expect(result.recent.items.filter(x=>x.id==='new')).toHaveLength(1);
 });
 it('上海日期在UTC跨日时仍用于同一批待办',async()=>{
  const read=readers();await queryWorkbench({type:'task',page:1},actor,{readers:read,now:new Date('2026-10-17T16:01:00Z')});expect(read.task).toHaveBeenCalledWith(actor,expect.objectContaining({today:'2026-10-18'}));
 });
 it('查询仅接收种类和页码，不接受身份、公司、数据集或无效页码',()=>{
  for(const bad of [{userId:'other'},{organizationId:'other'},{datasetId:'another'},{page:0},{page:'not-a-page'},{type:'unknown'}])expect(()=>workbenchQuerySchema.parse(bad)).toThrow();
  expect(workbenchQuerySchema.parse({})).toEqual({type:'all',page:1});
 });
});
describe('工作台记录自身范围链接',()=>{
 it('经营链接只含自己的公开范围和对象编号',()=>{
  const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:['c'],courseIds:['k'],channelIds:[],organizationId:'private-org',authorizedCampusIds:['private-campus']};
  const url=new URL(workbenchRecordLink('plan','run-one',{datasetId:'data-one',scope,sessionId:'session-one'}),'http://local');
  expect(url.pathname).toBe('/dashboard/agent');expect(url.searchParams.get('runId')).toBe('run-one');expect(url.searchParams.get('sessionId')).toBe('session-one');expect(url.searchParams.has('financeScope')).toBe(false);
  expect(url.search).not.toContain('organizationId');expect(url.search).not.toContain('authorizedCampusIds');expect(url.searchParams.has('review')).toBe(false);
 });
 it('学习和财务各使用自己的范围类型，不继承经营日期',()=>{
  const learning=new URL(workbenchRecordLink('analysis','session',{datasetId:'oulad',scope:{courseKeys:['AAA_2014J'],relativeDayStart:-10,relativeDayEnd:30,organizationId:'org'}}),'http://local');
  expect(learning.searchParams.has('learningScope')).toBe(true);expect(learning.searchParams.has('scope')).toBe(false);expect(learning.searchParams.has('financeScope')).toBe(false);
  const finance=new URL(workbenchRecordLink('task','task',{datasetId:'finance',scope:{years:[2025],organizationId:'org'}}),'http://local');expect(finance.searchParams.get('financeScope')).toBe('{"years":[2025]}');expect(finance.searchParams.has('scope')).toBe(false);
  expect(workbenchPeriod({years:[2023,2024]})).toBe('2023、2024 年度');expect(workbenchPeriod({courseKeys:[],relativeDayStart:-3,relativeDayEnd:40})).toBe('相对日 -3 至 40');
 });
 it('报告、知识和人群使用原有详情地址',()=>{
  expect(workbenchRecordLink('report','report')).toBe('/dashboard/reports/report');expect(workbenchRecordLink('material','version')).toBe('/dashboard/knowledge?sourceId=version');expect(workbenchRecordLink('segment','snapshot')).toBe('/dashboard/segments/risk?snapshotId=snapshot');
 });
});

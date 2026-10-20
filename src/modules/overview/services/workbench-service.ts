import 'server-only';
import {readDecisionWorkbench} from '@/modules/decision/server';
import {readAgentWorkbench} from '@/modules/agent/server';
import {readKnowledgeWorkbench} from '@/modules/knowledge/server';
import {readReportWorkbench} from '@/modules/report/server';
import {readTagWorkbench} from '@/modules/tag/server';
import {readSegmentWorkbench} from '@/modules/segment/server';
import type {WorkbenchActor,WorkbenchItem,WorkbenchKind,WorkbenchQuery,WorkbenchReadOptions,WorkbenchResult,WorkbenchSourceData,WorkbenchSourceStatus,WorkbenchTodoType} from '@/shared/contracts/workbench';
import {workbenchQuerySchema} from '@/shared/contracts/workbench';
import {compareWorkbenchTodos,recentWorkbenchItems} from '../domain/workbench';

type Reader=(actor:WorkbenchActor,options:WorkbenchReadOptions)=>Promise<WorkbenchSourceData>;
export interface WorkbenchReaders {task:Reader;agent:Reader;material:Reader;report:Reader;tag:Reader;segment:Reader;}
const readers:WorkbenchReaders={task:readDecisionWorkbench,agent:readAgentWorkbench,material:readKnowledgeWorkbench,report:readReportWorkbench,tag:readTagWorkbench,segment:readSegmentWorkbench};
const names:Record<keyof WorkbenchReaders,string>={task:'任务',agent:'分析方案',material:'知识材料',report:'报告',tag:'标签',segment:'人群'};
const kinds:Record<keyof WorkbenchReaders,WorkbenchKind[]>={task:['task'],agent:['plan','analysis'],material:['material'],report:['report'],tag:['tag'],segment:['segment']};

/** GET aggregation only. Each module decides its own ownership, state and lightweight projection. */
export async function queryWorkbench(input:WorkbenchQuery,actor:WorkbenchActor,dependencies:{readers?:WorkbenchReaders;now?:Date}={}):Promise<WorkbenchResult>{
 const query=workbenchQuerySchema.parse(input),now=dependencies.now??new Date(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const selectedReaders=dependencies.readers??readers,options:WorkbenchReadOptions={todoLimit:query.page*10,recentLimit:6,today};
 const keys=Object.keys(selectedReaders) as (keyof WorkbenchReaders)[];
 const results=await Promise.allSettled(keys.map(key=>selectedReaders[key](actor,options)));
 const sources={} as Record<WorkbenchKind,WorkbenchSourceStatus>,counts:WorkbenchResult['counts']={all:null,task:null,plan:null,material:null};
 const todos:WorkbenchItem[]=[],recent:WorkbenchItem[]=[];
 for(let index=0;index<keys.length;index++){
  const key=keys[index],result=results[index];
  if(result.status==='rejected'){
   for(const kind of kinds[key])sources[kind]={status:'error',message:names[key]+'暂时无法读取，请重试'};
   continue;
  }
  for(const kind of kinds[key])sources[kind]={status:'ready'};
  if(key==='task'||key==='material'||key==='agent')counts[key==='agent'?'plan':key]=result.value.count;
  todos.push(...result.value.todos);recent.push(...result.value.recent);
 }
 const todoKinds:WorkbenchTodoType[]=['task','plan','material'];
 if(todoKinds.every(key=>counts[key]!==null))counts.all=todoKinds.reduce((total,key)=>total+counts[key]!,0);
 const selected=query.type==='all'?todoKinds:[query.type],available=selected.filter(key=>sources[key].status==='ready').length;
 const total=counts[query.type],selectedItems=todos.filter(item=>selected.includes(item.kind as WorkbenchTodoType)).sort((a,b)=>compareWorkbenchTodos(a,b,today));
 const todoStatus=available===selected.length?'ready':available?'partial':'error';
 const availableRecent=Object.values(sources).filter(source=>source.status==='ready').length;
 const recentStatus=availableRecent===7?'ready':availableRecent?'partial':'error';
 return {
  generatedAt:now.toISOString(),counts,sources,
  todos:{items:selectedItems.slice((query.page-1)*10,query.page*10),page:query.page,pageSize:10,total,status:todoStatus,...(todoStatus==='ready'?{}:{message:todoStatus==='partial'?'部分待办未能读取，数量暂不完整，可重试':'待办暂时无法读取，请重试'})},
  recent:{items:recentWorkbenchItems(recent),status:recentStatus,...(recentStatus==='ready'?{}:{message:recentStatus==='partial'?'部分最近工作未能读取，可重试':'最近工作暂时无法读取，请重试'})},
 };
}

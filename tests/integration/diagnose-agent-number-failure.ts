// 仅诊断指定模拟数据原句的历史失败；SQL强制只读，测试运行必须显式指定UUID，不请求模型。
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {config} from 'dotenv';
import pg from 'pg';
import {buildConversationalAnswer} from '../../src/modules/agent/domain/conversation';
import type {AgentRunVO} from '../../src/modules/agent/contracts';

async function main(){
const env={...process.env};
const testRunId=process.argv.find(value=>value.startsWith('--test-run='))?.slice('--test-run='.length);
if(testRunId&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(testRunId))throw Error('测试运行编号无效');
if(testRunId)Object.assign(env,{DATABASE_URL:'postgresql://postgres:test_password@127.0.0.1:25432/education_cleanup_test',COMPANY_REGISTRY_JSON:'',DEFAULT_COMPANY_CODE:'main',SYSTEM_USER_ID:'6f40f555-5f1b-4d1f-807c-b209e817bfdd'});
else config({path:[resolve('.env.local'),resolve('.env')],processEnv:env,quiet:true});
const target=new URL(env.DATABASE_URL??'');
if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!==(testRunId?'25432':'15434')||target.pathname!==(testRunId?'/education_cleanup_test':'/metadata_dev'))throw Error('仅允许明确的本机库只读诊断');
const companyCode=env.DEFAULT_COMPANY_CODE??'main',companies=env.COMPANY_REGISTRY_JSON?JSON.parse(env.COMPANY_REGISTRY_JSON):[{code:'main',organizationId:env.SYSTEM_USER_ID}];
const org=companies.find((c:{code:string})=>c.code===companyCode)?.organizationId;
if(!org)throw Error('缺少默认公司');
const db=new pg.Client({connectionString:target.toString(),options:'-c default_transaction_read_only=on',application_name:'agent-number-diagnosis-readonly'});
try{
 await db.connect();
 const rows=(await db.query(`SELECT e.id,e.status,e."errorCode",e."startedAt",e.answer,e.steps,e.proposals FROM agent_execution e JOIN agent_session s ON s.id=e."sessionId" JOIN education_dataset d ON d.id=s."datasetId" WHERE e."organizationId"=$1::uuid AND d."organizationId"=$1::uuid AND d.origin='simulated' AND e.message=$2${testRunId?' AND e.id=$3::uuid':''} ORDER BY e."startedAt" DESC LIMIT 3`,[org,'帮我看看当前范围的出勤情况，比较变化并拆解可能受影响的课程。',...(testRunId?[testRunId]:[])])).rows;
 const records=rows.map(row=>{
  const steps:AgentRunVO['steps']=row.steps??[],context=steps.findLast(s=>s.context)?.context,rounds=steps.find(s=>s.id==='context')?.runtime?.input?.rounds??[];
  const attempts=rounds.flatMap(round=>round.messages.filter(m=>m.role==='assistant'&&typeof m.content==='string'&&!m.tool_calls?.length).map(m=>{
   let validation:unknown;try{if(context)buildConversationalAnswer(m.content,row.answer?.facts??steps.flatMap(s=>s.facts??[]),context,row.proposals??[]);validation={valid:true};}catch(error){const safe=error as {code?:string;fields?:string[]};validation={valid:false,code:safe.code,fields:safe.fields};}
   // 只输出数字形式及校验路径，不输出完整模型正文、成员资料或输入消息。
   const numbers=Array.from(new Set((m.content??'').replace(/\{\{[^{}]*\}\}/g,'').replace(/"factIds"\s*:\s*\[[\s\S]*?\]/g,'').match(/(?:\d[\d,.%-]*|[零〇一二两三四五六七八九十百千万亿]+(?:人|次|天|月|年|元|课时|个百分点))/g)??[])).slice(0,30);
   let excerpts:unknown=[];try{const raw=JSON.parse(m.content??'null');excerpts=((validation as {fields?:string[]})?.fields??[]).map(path=>{const value=path.split('.').reduce((node:any,key)=>node?.[key],raw);return {path,text:typeof value==='string'?value.replace(/\{\{[^{}]*\}\}/g,'[已验证引用]').replace(/\b\d{10,}\b/g,'[长编号]').slice(0,220):''};});}catch{/* 无效JSON仅保留校验结果 */}
   return {round:round.round,validation,numericTokens:numbers,excerpts};
  }));
  return {id:row.id,status:row.status,errorCode:row.errorCode,startedAt:row.startedAt,facts:row.answer?.facts?.length??0,engine:steps.find(s=>s.id==='context')?.runtime?.engineVersion,hasFreeze:!!steps.find(s=>s.id==='context')?.runtime?.freeze,tools:steps.map(s=>({name:s.tool,status:s.status,facts:s.facts?.length??0})),savedRepairInputs:attempts,finalRawResponsePersisted:false};
 });
 const result={readOnly:true,modelRequests:0,records};
 const out=resolve('tests/artifacts/agent-number-fix');await mkdir(out,{recursive:true});await writeFile(resolve(out,testRunId?'test-diagnosis-'+testRunId+'.json':'normal-diagnosis.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await db.end();}
}
main().catch(()=>{console.error('只读诊断未完成');process.exitCode=1;});

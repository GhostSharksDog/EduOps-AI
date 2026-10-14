// 正常项目：两组模拟聚合事实的真实云模型验证；保留记录，绝不预填人工评分。
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base='http://localhost:3000',directory=process.env.LOCAL_QA_ARTIFACT_DIR??'tests/artifacts/research-qa/normal';
const username=process.env.LOCAL_QA_USERNAME,password=process.env.LOCAL_QA_PASSWORD;
if(!username||!password)throw Error('只通过运行环境传入已存在的本地账号');
await mkdir(directory,{recursive:true});
const auth=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(auth.status,200);const {token}=await auth.json();
const request=async(path,body)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(160000)});const b=await r.json();assert.equal(r.status,200,path+': '+(b.message??''));return b.data;};
const datasets=await request('/api/education/datasets'),dataset=datasets.find(d=>d.key==='training-sim-20261009-v3');assert.ok(dataset);
let stored={testedAt:new Date().toISOString(),source:'正常项目模拟聚合事实；配置的真实云模型',cases:[],subjectiveScoresWritten:false};
try{stored=JSON.parse(await readFile(directory+'/cloud-cases.json','utf8'));}catch{}
for(const c of [{id:'normal',kind:'monthly',anchorDate:'2026-07-01',courseIds:[]},{id:'attendance',kind:'monthly',anchorDate:'2026-08-01',courseIds:['sim:course:1']}]){
 let current=stored.cases.find(r=>r.caseId===c.id);
 if(current?.reportStatus==='failed'&&process.argv.includes('--retry-failed')){const previous=current;current={caseId:c.id,requestKey:randomUUID(),startedAt:new Date().toISOString(),previousAttempts:[...(previous.previousAttempts??[]),{reportId:previous.reportId,status:previous.reportStatus,error:previous.error}]};stored.cases[stored.cases.indexOf(previous)]=current;}
 if(!current){current={caseId:c.id,requestKey:randomUUID(),startedAt:new Date().toISOString()};stored.cases.push(current);}
 await writeFile(directory+'/cloud-cases.json',JSON.stringify(stored,null,2));
 try{
  const report=current.reportId?await request('/api/reports/'+current.reportId):await request('/api/reports',{datasetId:dataset.id,kind:c.kind,anchorDate:c.anchorDate,campusIds:[],courseIds:c.courseIds,channelIds:[],requestKey:current.requestKey});
  current.reportId=report.id;current.reportStatus=report.status;current.error=report.errorMessage??null;
  assert.ok(report.snapshot.evaluationContext?.inputs?.length,'新报告缺实际模型输入');
  current.model=report.snapshot.evaluationContext.model;current.factCount=report.facts.length;
  await writeFile(directory+'/cloud-cases.json',JSON.stringify(stored,null,2));
  if(report.status!=='completed'){console.log(c.id+'报告未成功，已保留真实状态');continue;}
  const rows=await request('/api/decisions/evaluations',{reportId:report.id,caseId:c.id});assert.equal(rows.length,3);assert.ok(rows.every(r=>r.scores===null&&!r.ratingHistory.length));assert.ok(rows.every(r=>r.context?.strict));
  current.evaluations=rows.map(r=>({id:r.id,method:r.method,status:r.status,error:r.error,model:r.context.model,strict:r.context.strict,checks:r.context.checks}));current.finishedAt=new Date().toISOString();
  console.log(c.id+'真实云模型样本：'+rows.map(r=>r.method+'='+r.status).join('，'));
 }catch(e){current.error=String(e.message).replaceAll(password,'[隐去]').replaceAll(username,'[账号]');console.log(c.id+'未通过；失败原因已保存');}
 await writeFile(directory+'/cloud-cases.json',JSON.stringify(stored,null,2));
}
if(process.argv.includes('--include-failed'))for(const c of stored.cases)for(const previous of c.previousAttempts??[]){if(previous.status!=='failed')continue;const rows=await request('/api/decisions/evaluations',{reportId:previous.reportId,caseId:c.caseId});assert.equal(rows.find(r=>r.method==='tool_agent').status,'failed');assert.ok(rows.every(r=>r.scores===null));previous.evaluations=rows.map(r=>({id:r.id,method:r.method,status:r.status,error:r.error,model:r.context?.model,strict:r.context?.strict}));}
const all=await request('/api/decisions/evaluations'),selected=all.filter(r=>stored.cases.some(c=>c.reportId===r.reportId));assert.ok(selected.every(r=>r.scores===null&&!r.ratingHistory.length));
const columns=['caseId','reportId','evaluationId','method','status','model','strict','scores'],csv=[columns.join(',')];for(const c of stored.cases)for(const attempt of [c,...(c.previousAttempts??[])])for(const r of attempt.evaluations??[])csv.push([c.caseId,attempt.reportId,r.id,r.method,r.status,r.model,r.strict,'待实际评阅'].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','));await writeFile(directory+'/cloud-evaluation-metadata.csv','\uFEFF'+csv.join('\n')+'\n');
stored.complete=stored.cases.length===2&&stored.cases.every(c=>c.reportStatus==='completed'&&c.evaluations?.every(e=>e.status==='completed'));await writeFile(directory+'/cloud-cases.json',JSON.stringify(stored,null,2));console.log(JSON.stringify({groups:stored.cases.length,complete:stored.complete,subjectiveScoresWritten:false}));if(!stored.complete)process.exitCode=1;

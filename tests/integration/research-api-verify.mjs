// 只读真实_test复核：复用真实云验收账号/执行，不创建夹具、不调用模型、不改业务记录。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {SignJWT} from 'jose';
const base='http://127.0.0.1:3302',artifact=path.resolve('tests/artifacts/agent-upgrade-qa/research-api.json');
function check(value,code){if(!value)throw Error(code);}
function rawRuntime(value){
 if(Array.isArray(value))return value.some(rawRuntime);
 if(!value||typeof value!=='object')return false;
 if(value.runtime&&typeof value.runtime==='object'&&['input','requestInputs','messages','tools'].some(key=>key in value.runtime))return true;
 return Object.values(value).some(rawRuntime);
}
function summaries(value,output=[]){if(Array.isArray(value))for(const row of value)summaries(row,output);else if(value&&typeof value==='object'){if(value.runtime?.inputSummary)output.push(value.runtime.inputSummary);for(const row of Object.values(value))summaries(row,output);}return output;}
const result={status:'running',startedAt:new Date().toISOString(),testServer:base,database:'education_cleanup_test',writes:0,modelCalls:0,checks:[]};
let currentCheck='health';
try{
 check(process.argv.includes('--connect'),'CONNECT_REQUIRED');
 const health=await fetch(base+'/api/health',{signal:AbortSignal.timeout(30000)}).then(r=>r.json());check(health.testMode===true,'TEST_SERVER_GUARD');
 const saved=JSON.parse(await readFile('tests/artifacts/agent-upgrade-cloud/verification.json','utf8'));check(saved.status==='passed'&&saved.database==='education_cleanup_test'&&saved.companyCode==='main','CLOUD_RECORD_GUARD');
 const guide=saved.stages.find(s=>s.name==='guide').result.run,analysis=saved.stages.find(s=>s.name==='attendance-analysis').result.run;
 const org='6f40f555-5f1b-4d1f-807c-b209e817bfdd',key=new TextEncoder().encode('phase4_test_only_secret_at_least_32_characters');
 const sign=ownedBy=>new SignJWT({id:saved.actorId,ownedBy,companyCode:'main',role:'admin'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(key),token=await sign(org);
 async function request(url,body,auth=token){const response=await fetch(base+url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const data=await response.json();return {status:response.status,data};}
 currentCheck='candidates';const candidates=await request('/api/agent/research/runs');check(candidates.status===200&&Array.isArray(candidates.data.data),'CANDIDATE_QUERY_FAILED');check(candidates.data.data.some(r=>r.id===guide.id)&&candidates.data.data.some(r=>r.id===analysis.id),'CLOUD_CANDIDATES_MISSING');result.checks.push({name:'候选目录',passed:true,count:candidates.data.data.length});
 currentCheck='comparison';const comparison=await request('/api/agent/research/compare',{oldRunId:guide.id,newRunId:analysis.id});check(comparison.status===200,'COMPARISON_QUERY_FAILED');const compared=comparison.data.data;check(compared.strict===false&&compared.old.model===null&&compared.new.model===null&&!compared.old.inputsRecorded&&!compared.new.inputsRecorded,'HISTORICAL_INPUT_GUESSED');check(compared.manualEvaluation==='pending'&&compared.old.actions.formallyCompleted===null,'CONVERSATION_MARKED_TASK_COMPLETE');check(!rawRuntime(comparison.data),'RESEARCH_INPUT_EXPOSED');result.comparison=compared;result.checks.push({name:'旧记录描述性比较、模型与输入留空、人工待评价',passed:true});
 const foreign=await sign('22222222-2222-4222-8222-222222222222');const denial=await request('/api/agent/research/compare',{oldRunId:guide.id,newRunId:analysis.id},foreign);check([401,404].includes(denial.status),'FOREIGN_ORGANIZATION_ACCEPTED');result.checks.push({name:'伪造跨公司身份拒绝',passed:true,httpStatus:denial.status});
 const resources=['/api/agent/runs/'+analysis.id,'/api/agent/sessions/'+analysis.sessionId,'/api/agent/runs/progress?runId='+analysis.id];
 const recent=candidates.data.data.find(r=>!['running','queued'].includes(r.status)&&r.id!==analysis.id);if(recent)resources.push('/api/agent/runs/'+recent.id,'/api/agent/runs/progress?runId='+recent.id,'/api/agent/sessions/'+recent.sessionId);
 const recorded=[];
 for(const resource of [...new Set(resources)]){currentCheck=resource;const response=await request(resource);check(response.status===200,'PUBLIC_READ_FAILED');check(!rawRuntime(response.data),'PUBLIC_RAW_MODEL_INPUT_EXPOSED');const metadata=summaries(response.data);recorded.push(...metadata);result.checks.push({name:'公共执行／会话／进度不暴露内部输入',resource,passed:true,inputSummaries:metadata});}
 result.actualInputSummaryVerified=recorded.some(s=>s.recorded&&s.calls>0&&/^[0-9a-f]{64}$/.test(s.sha256));
 if(!result.actualInputSummaryVerified)result.limitations=['所选历史记录没有新增输入审计，HTTP真实输入摘要尚无适用记录；递归过滤已通过单元验证。'];
 result.status='passed';
}catch(error){result.status='failed';result.errorCode=/^[A-Z_]{3,100}$/.test(error?.message??'')?error.message:'READ_ONLY_API_CHECK_FAILED';result.errorStage=currentCheck;result.errorName=error?.name;process.exitCode=1;}
result.completedAt=new Date().toISOString();await mkdir(path.dirname(artifact),{recursive:true});const content=JSON.stringify(result,null,2)+'\n';await writeFile(artifact,content);await writeFile(artifact.replace(/\.json$/, '-'+result.startedAt.replace(/[:.]/g,'-')+'.json'),content);console.log(JSON.stringify({status:result.status,errorCode:result.errorCode,errorStage:result.errorStage,checks:result.checks.length,actualInputSummaryVerified:result.actualInputSummaryVerified,artifact}));

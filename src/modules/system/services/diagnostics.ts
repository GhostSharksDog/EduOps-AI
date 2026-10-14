import 'server-only';
import {db} from '@/platform/database';
import {EducationEventsClient} from '@/platform/database/education-events';
import type {AgentActor} from '@/modules/agent/contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {DiagnosticCheck,RuntimeDiagnostics} from '../contracts/diagnostics';
import type {QueryConfig} from 'pg';

export const diagnosticTables=['local_user','education_dataset','education_import_batch','education_record','education_risk_proposal','education_segment_snapshot','knowledge_source_version','knowledge_chunk','agent_session','agent_message','agent_execution','operational_alert','operational_report','decision_task','decision_feedback','analysis_evaluation','system_config','tag','tag_version','tag_category'] as const;
export const diagnosticColumns=['decision_task.goals','decision_feedback.quantitativeReview'] as const;
const eventColumns=['organization_id','dataset_id','batch_id','kind','source_id','payload','student_id','campus_id','course_id','class_id','occurred_at','relative_day','version'];
type PostgresStatus={tables:string[];columns:string[];vector:boolean};
type ModelStatus='configured'|'missing'|'invalid';
interface DiagnosticPorts {
 postgres:()=>Promise<PostgresStatus>;
 clickhouse:()=>Promise<boolean|{exists:boolean;columns:string[]}>;
 models:()=>{chat:ModelStatus;embedding:ModelStatus};
}
const elapsed=(started:number)=>Math.round((performance.now()-started)*100)/100;
// 读取结果只保留固定状态与白名单结构名；驱动错误、连接值和账号不进入响应。
export function createDiagnosticsService(ports:DiagnosticPorts){return {
 async query(actor:AgentActor):Promise<RuntimeDiagnostics>{
  if(!['admin','operator'].includes(actor.role))throw new WorkflowError('只有管理员和运营人员可以查看运行诊断',403,'DIAGNOSTICS_FORBIDDEN');
  const started=performance.now();
  const [postgres,clickhouse]=await Promise.all([
   (async():Promise<DiagnosticCheck[]>=>{
    const began=performance.now();
    try{
     const result=await ports.postgres(),missing=[...diagnosticTables.filter(t=>!result.tables.includes(t)),...diagnosticColumns.filter(c=>!result.columns.includes(c))];
     return [
      {id:'postgres',title:'业务数据库连接',state:'ready',description:'已完成只读连接检查。',recovery:'',durationMs:elapsed(began)},
      {id:'schema',title:'必要业务结构',state:missing.length?'warning':'ready',description:missing.length?'当前环境缺少运行所需的表或字段。':'核心业务表和决策复核字段已就绪。',recovery:missing.length?'请管理员核对初始化 SQL 与开发说明；已有数据库仅补充明确列出的追加区块。':'',details:missing,href:missing.length?'/dashboard/help#environment':undefined},
      {id:'vector',title:'知识向量扩展',state:result.vector?'ready':'warning',description:result.vector?'pgvector 扩展已启用。':'当前数据库未发现 vector 扩展，知识索引与检索可能不可用。',recovery:result.vector?'':'请管理员按启动说明核对 PostgreSQL 镜像与 vector 扩展；检查不会自动安装扩展。',href:result.vector?undefined:'/dashboard/help#environment'},
     ];
    }catch{return [
     {id:'postgres',title:'业务数据库连接',state:'failed',description:'暂时无法完成业务数据库检查。',recovery:'检查数据库服务是否已启动，以及服务端连接配置与访问权限；恢复后重新检查。',href:'/dashboard/help#environment',durationMs:elapsed(began)},
     {id:'schema',title:'必要业务结构',state:'blocked',description:'数据库未连接，暂不能判断表与字段是否齐全。',recovery:'先恢复业务数据库连接。'},
     {id:'vector',title:'知识向量扩展',state:'blocked',description:'数据库未连接，暂不能判断向量扩展状态。',recovery:'先恢复业务数据库连接。'},
    ];}
   })(),
   (async():Promise<DiagnosticCheck[]>=>{
    const began=performance.now();
    try{const status=await ports.clickhouse(),exists=typeof status==='boolean'?status:status.exists,missing=typeof status==='boolean'?[]:eventColumns.filter(c=>!status.columns.includes(c));return [
     {id:'clickhouse',title:'行为数据库连接',state:'ready',description:'已完成 ClickHouse 只读连接检查。',recovery:'',durationMs:elapsed(began)},
     {id:'events',title:'学习与经营事件存储',state:exists&&!missing.length?'ready':'warning',description:exists?(missing.length?'教育行为表缺少必要字段。':'教育行为事件表及必要字段已就绪。'):'当前数据库未发现教育行为事件表。',recovery:exists&&!missing.length?'':'确认行为数据库配置及表结构。新环境可从数据中心按既有流程接入数据，检查本身不会建表。',details:exists?missing:undefined,href:exists&&!missing.length?undefined:'/dashboard/help#environment'},
    ];}catch{return [
     {id:'clickhouse',title:'行为数据库连接',state:'failed',description:'暂时无法完成行为数据库检查。',recovery:'检查 ClickHouse 服务、服务端连接配置及只读访问权限；恢复后重新检查。',href:'/dashboard/help#environment',durationMs:elapsed(began)},
     {id:'events',title:'学习与经营事件存储',state:'blocked',description:'行为数据库未连接，暂不能判断事件表状态。',recovery:'先恢复行为数据库连接。'},
    ];}
   })(),
  ]);
  const models=ports.models();
  const modelChecks=(['chat','embedding'] as const).map((id):DiagnosticCheck=>{
   const state=models[id],title=id==='chat'?'对话模型配置':'向量模型配置';
   return {id,title,state:state==='configured'?'ready':'warning',description:state==='configured'?'必要配置齐全；本次未向模型发送请求。':state==='missing'?'模型配置未填写完整。':'模型接口地址格式不正确。',recovery:state==='configured'?'模型实际可用性需在分析或知识索引时验证。':'请管理员按启动说明填写对应接口地址、密钥和模型名称，重启应用后重新检查。',href:state==='configured'?undefined:'/dashboard/help#environment'};
  });
  const checks=[...postgres,...clickhouse,...modelChecks];
  return {checkedAt:new Date().toISOString(),state:checks.every(c=>c.state==='ready')?'ready':'attention',checks,durationMs:elapsed(started),modelNetworkChecked:false};
 }
};}

export function inspectModelEnvironment(environment:NodeJS.ProcessEnv):{chat:ModelStatus;embedding:ModelStatus}{
 const inspect=(prefix:'CHAT'|'EMBEDDING'):ModelStatus=>{
  const values=['API_BASE_URL','API_KEY','MODEL'].map(s=>environment[prefix+'_'+s]?.trim());
  if(values.some(value=>!value))return 'missing';
  try{const url=new URL(values[0]!);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?'configured':'invalid';}catch{return 'invalid';}
 };
 return {chat:inspect('CHAT'),embedding:inspect('EMBEDDING')};
}

export const runtimeDiagnosticsService=createDiagnosticsService({
 async postgres(){
  const query:QueryConfig&{query_timeout:number}={text:`SELECT
   ARRAY(SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])) AS tables,
   ARRAY(SELECT table_name||'.'||column_name FROM information_schema.columns WHERE table_schema='public' AND table_name||'.'||column_name=ANY($2::text[])) AS columns,
   EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS vector`,values:[diagnosticTables,diagnosticColumns],query_timeout:8000};
  const result=await db.query<PostgresStatus>(query);
  if(!result.rows[0])throw new Error('diagnostic result unavailable');
  return result.rows[0];
 },
 async clickhouse(){
  // 不使用 queryRows/read，它们会调用 ensureTable；诊断仅执行固定系统表查询。
  const text=await new EducationEventsClient().execute("SELECT count() AS present FROM system.tables WHERE database=currentDatabase() AND name='education_events_v1' SETTINGS max_execution_time=8 FORMAT JSONEachRow",{},undefined,{timeoutMs:8000});
  const result:unknown=JSON.parse(text.trim());
  if(!result||typeof result!=='object'||!('present' in result)||!['0','1'].includes(String(result.present)))throw new Error('diagnostic result unavailable');
  const columns=await new EducationEventsClient().execute("SELECT name FROM system.columns WHERE database=currentDatabase() AND table='education_events_v1' SETTINGS max_execution_time=8 FORMAT JSONEachRow",{},undefined,{timeoutMs:8000});
  return{exists:Number(result.present)===1,columns:columns.trim()?columns.trim().split('\n').map(line=>String(JSON.parse(line).name)):[]};
 },
 models:()=>inspectModelEnvironment(process.env),
});

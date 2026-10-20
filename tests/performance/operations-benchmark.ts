/** 仅在独立_test库生成经营压力数据；数据生成与查询计量使用不同进程。 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {guardOperationsTest,seedOperationsFixture} from './operations-fixture';
import {db,queryOne} from '../../src/platform/database';
import {EducationEventsClient} from '../../src/platform/database/education-events';
import {operations,channels} from '../../src/modules/analytics/server';
import {calculateOperations} from '../../src/modules/analytics/domain/operations';
import type {AuthorizedScope} from '../../src/shared/contracts/analysis';
import {runStandaloneTestCompany} from '../helpers/standalone-company';
const args=process.argv.slice(2),value=(name:string,fallback='')=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]??fallback;},has=(name:string)=>args.includes(name),events=new EducationEventsClient();
const metricsComparable=(metrics:ReturnType<typeof calculateOperations>['metrics'])=>metrics.map(({code,numerator,denominator,value,status,unknownCount,details})=>({code,numerator,denominator,value,status,unknownCount,details}));
const canonical=(input:unknown):unknown=>Array.isArray(input)?input.map(canonical):input&&typeof input==='object'?Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,canonical(value)])):input;
const equal=(left:unknown,right:unknown)=>JSON.stringify(canonical(left))===JSON.stringify(canonical(right));
type QueryKind='metrics'|'trend'|'channels'|'admissions';
async function query(kind:QueryKind,datasetId:string,scope:AuthorizedScope){
 if(kind==='channels'){const r=await channels.query(datasetId,scope);return{overall:metricsComparable(r.overall.metrics),groups:r.groups.map(g=>({id:g.id,metrics:metricsComparable(g.analysis.metrics),funnel:g.funnel}))};}
 if(kind==='trend'){const prepared=await operations.prepare(datasetId,scope),out=[];for(let month=4;month<=9;month++){const startDate='2026-'+String(month).padStart(2,'0')+'-01',endDate=new Date(Date.UTC(2026,month,0)).toISOString().slice(0,10);const r=await operations.queryPrepared(prepared,{...scope,startDate,endDate},undefined,false);out.push({period:startDate.slice(0,7),metrics:metricsComparable(r.metrics)});}return out;}
 const r=await operations.query(datasetId,scope,kind==='admissions'?['admission_conversion']:undefined);return metricsComparable(r.metrics);
}
async function worker(){
 guardOperationsTest();const concurrency=Number(value('--concurrency','1')),repeat=Number(value('--repeat','1')),cold=has('--cold'),kind=value('--query','metrics') as QueryKind;
 if(![1,5].includes(concurrency)||repeat<1||repeat>5||!['metrics','trend','channels','admissions'].includes(kind))throw Error('基准参数无效');
 const scope:AuthorizedScope={organizationId:value('--organization'),authorizedCampusIds:[],campusIds:[],courseIds:[],channelIds:[],startDate:'2026-08-01',endDate:'2026-08-31'},datasetId=value('--dataset');
 const samples=[];let rss=process.memoryUsage().rss;const timer=setInterval(()=>rss=Math.max(rss,process.memoryUsage().rss),20);
 try{
  if(!cold)await query(kind,datasetId,scope);
  for(let run=0;run<repeat;run++){
   if(cold){await events.execute('SYSTEM DROP MARK CACHE');await events.execute('SYSTEM DROP UNCOMPRESSED CACHE');}
   const began=performance.now(),startedAt=new Date().toISOString();
   const results=await Promise.all(Array.from({length:concurrency},async()=>{const start=performance.now(),result=await query(kind,datasetId,scope);return{durationMs:Math.round((performance.now()-start)*100)/100,result};}));
   const resource=await events.queryRows(`SELECT metric,value FROM system.metrics WHERE metric IN ('MemoryTracking','Query','QueryThread')`);
   samples.push({run:run+1,startedAt,totalMs:Math.round((performance.now()-began)*100)/100,requests:results.map(r=>r.durationMs),result:results[0].result,allRequestsEqual:results.every(r=>equal(r.result,results[0].result)),rssPeakBytes:rss,maxRssBytes:process.resourceUsage().maxRSS*1024,clickhouseMetrics:resource});
  }
  return samples;
 }finally{clearInterval(timer);}
}
function runChild(args:string[]):Promise<unknown>{return new Promise((resolve,reject)=>{execFile(process.execPath,['--conditions=react-server','--import','tsx',fileURLToPath(import.meta.url),'--worker',...args],{cwd:process.cwd(),env:process.env,windowsHide:true,maxBuffer:12*1024*1024},(error,stdout,stderr)=>{if(error){reject(Error(stderr.trim()||'独立查询进程失败'));return;}try{resolve(JSON.parse(stdout));}catch{reject(Error('独立查询进程没有返回有效结果'));}});});}
async function main(){
 guardOperationsTest();const output=path.resolve(value('--output',process.env.TEST_ARTIFACT_DIR?path.join(process.env.TEST_ARTIFACT_DIR,'operations-performance'):'../operations-performance')),reuse=value('--reuse');await mkdir(output,{recursive:true});
 let fixture:{org:string;datasetId:string;eventRows:number;expectedRows:Record<string,number>;replication:number},baseline:Record<string,unknown>;
 if(reuse){const previous=JSON.parse(await readFile(path.resolve(reuse),'utf8'));fixture=previous.fixture;baseline=previous.baseline;}
 else{
  const seeded=await seedOperationsFixture({students:1000,replication:32});fixture={org:seeded.org,datasetId:seeded.datasetId,eventRows:seeded.eventRows,expectedRows:seeded.expectedRows,replication:seeded.replication};
  if(fixture.eventRows<1_000_000)throw Error('压力数据未达到百万事件，不能作为百万性能结果');
  const scope:AuthorizedScope={organizationId:fixture.org,authorizedCampusIds:[],campusIds:[],courseIds:[],channelIds:[],startDate:'2026-08-01',endDate:'2026-08-31'};
  baseline={metrics:metricsComparable(calculateOperations(seeded.snapshot,scope).metrics),admissions:metricsComparable(calculateOperations(seeded.snapshot,scope,['admission_conversion']).metrics),trend:Array.from({length:6},(_,i)=>{const month=i+4,startDate='2026-'+String(month).padStart(2,'0')+'-01',endDate=new Date(Date.UTC(2026,month,0)).toISOString().slice(0,10);return{period:startDate.slice(0,7),metrics:metricsComparable(calculateOperations(seeded.snapshot,{...scope,startDate,endDate}).metrics)};})};
  const {OperationsService}=await import('../../src/modules/analytics/services/operations-service'),{ChannelsService}=await import('../../src/modules/analytics/services/channels-service'),education={snapshot:async()=>seeded.snapshot},pure=new ChannelsService(education,new OperationsService(education)),result=pure.fromSnapshot(seeded.snapshot,scope);
  baseline.channels={overall:metricsComparable(result.overall.metrics),groups:result.groups.map(g=>({id:g.id,metrics:metricsComparable(g.analysis.metrics),funnel:g.funnel}))};
 }
 await writeFile(path.join(output,'fixture.json'),JSON.stringify({fixture,baseline},null,2));
 // 项目db代理在end后移除全局池；末尾资源观测会延迟创建独立连接池。
 // 不让生成阶段的连接持有干扰独立查询进程。
 await db.end();
 if(has('--prepare-only')){console.log(JSON.stringify({output,fixture,eventRows:fixture.eventRows,measurementStarted:false}));return;}
 const records:Record<string,unknown>[]=[];
 for(const kind of ['metrics','trend','channels','admissions'] as const)for(const concurrency of [1,5])for(const cache of ['cold','warm'] as const){
  const args=['--dataset',fixture.datasetId,'--organization',fixture.org,'--query',kind,'--concurrency',String(concurrency)],samples:Record<string,unknown>[]=[];
  if(cache==='cold')for(let repetition=0;repetition<5;repetition++)samples.push(...await runChild([...args,'--cold','--repeat','1']) as Record<string,unknown>[]);
  else samples.push(...await runChild([...args,'--repeat','5']) as Record<string,unknown>[]);
  const matches=samples.every(s=>s.allRequestsEqual&&equal(s.result,baseline[kind]));records.push({query:kind,concurrency,cache,repetitions:5,matchesBaseline:matches,samples});
  await writeFile(path.join(output,'results.json'),JSON.stringify({fixture,records,complete:false},null,2));
  process.stderr.write(JSON.stringify({query:kind,concurrency,cache,matchesBaseline:matches})+'\n');
 }
 const postgres=await queryOne(`SELECT pg_database_size(current_database()) bytes,numbackends,xact_commit,xact_rollback,blks_read,blks_hit FROM pg_stat_database WHERE datname=current_database()`),clickhouse=await events.queryRows(`SELECT sum(rows) rows,sum(bytes_on_disk) bytes FROM system.parts WHERE database=currentDatabase() AND table='education_events_v1' AND active`);
 const notes=['数据生成、纯计算对照和实测查询分别运行，查询进程不保留百万行为数组。','冷查询使用新应用进程并清除ClickHouse mark/uncompressed缓存；未清空操作系统文件页缓存，不能称为物理磁盘完全冷读。','暖查询先完整预热同一查询一次；每种查询并发1和5，各冷/暖组分别重复5次。','压力数据只扩展签到重复来源与课耗等额分拆，使用2的幂保证净课耗精确等价；不声称增加了真实学员或真实经营规模。','数据库资源是专用测试服务的观测值，不能解释为单个查询独占；正常库及原第三版数据未扩容。'];
 const report={generatedAt:new Date().toISOString(),fixture,records,complete:true,passed:records.every(r=>r.matchesBaseline),resources:{postgres,clickhouse},notes};await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));
 const csv=['query,concurrency,cache,repetition,total_ms,request_ms,rss_peak_bytes,matches_baseline'];for(const record of records)for(const [i,s]of(record.samples as Record<string,unknown>[]).entries())csv.push([record.query,record.concurrency,record.cache,i+1,s.totalMs,'"'+(s.requests as number[]).join(';')+'"',s.rssPeakBytes,record.matchesBaseline].join(','));await writeFile(path.join(output,'measurements.csv'),'\uFEFF'+csv.join('\n')+'\n');
 console.log(JSON.stringify({output,eventRows:fixture.eventRows,passed:report.passed,groups:records.length}));if(!report.passed)process.exitCode=1;
}
Promise.resolve().then(()=>runStandaloneTestCompany(async()=>{try{if(has('--worker'))console.log(JSON.stringify(await worker()));else await main();}finally{await db.end();}})).catch(error=>{console.error(error instanceof Error?error.message:'经营性能核验失败');process.exitCode=1;});

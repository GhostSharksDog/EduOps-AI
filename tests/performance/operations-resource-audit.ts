/** 完成性能计量之后读取ClickHouse查询日志；不把结束时瞬时内存当作峰值。 */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {guardOperationsTest} from './operations-fixture';
import {EducationEventsClient} from '../../src/platform/database/education-events';
import {db} from '../../src/platform/database';
const args=process.argv.slice(2),input=args[args.indexOf('--results')+1];
async function main(){
 guardOperationsTest();if(!args.includes('--results')||!input)throw Error('请显式指定已完成的results.json');
 const file=path.resolve(input),results=JSON.parse(await readFile(file,'utf8'));if(!results.complete)throw Error('性能计量尚未完成，不能并发刷新查询日志');
 const events=new EducationEventsClient(),samples:Record<string,unknown>[]=[];let status='ready',reason='';
 try{
  await events.execute('SYSTEM FLUSH LOGS');
  for(const record of results.records)for(const [index,sample]of record.samples.entries()){
   const start=new Date(sample.startedAt),end=new Date(start.getTime()+Math.ceil(sample.totalMs)+1);
   const row=(await events.queryRows(`SELECT count() queries,max(memory_usage) max_single_query_peak_bytes,sum(read_rows) read_rows,sum(read_bytes) read_bytes,max(query_duration_ms) longest_query_ms,sum(query_duration_ms) summed_query_ms FROM system.query_log WHERE type='QueryFinish' AND query_start_time_microseconds>={start:DateTime64(6,'UTC')} AND query_start_time_microseconds<={end:DateTime64(6,'UTC')} AND has(tables,concat({database:String},'.education_events_v1'))`,{start:start.toISOString().replace('T',' ').replace('Z',''),end:end.toISOString().replace('T',' ').replace('Z',''),database:'education_cleanup_test'}))[0]??{};
   samples.push({query:record.query,concurrency:record.concurrency,cache:record.cache,repetition:index+1,startedAt:sample.startedAt,queryCount:Number(row.queries??0),maxSingleQueryPeakBytes:Number(row.max_single_query_peak_bytes??0),readRows:Number(row.read_rows??0),readBytes:Number(row.read_bytes??0),longestQueryMs:Number(row.longest_query_ms??0),summedQueryMs:Number(row.summed_query_ms??0)});
  }
  if(samples.some(s=>s.queryCount===0)){status='partial';reason='部分窗口没有可读查询日志，相关数据库峰值未测定，不能用零值解释。';}
 }catch{status='unavailable';reason='测试服务的查询日志或刷新权限不可用，数据库查询峰值未测定。';}
 const report={capturedAt:new Date().toISOString(),status,reason,samples,notes:['maxSingleQueryPeakBytes为每个采样窗口内单条ClickHouse查询记录的最大memory_usage，不是整个数据库进程峰值，也不是并发查询峰值之和。','readRows/readBytes为窗口内涉及education_events_v1的已完成查询合计，重复扫描会重复计数。','只读取既定计量窗口，不输出SQL、绑定参数或业务明细；缓存清理与预热在窗口之外。','应用采样RSS峰值保留在主results.json。']};
 const output=path.join(path.dirname(file),'database-resources.json');await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output,status,samples:samples.length}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'资源审计失败');process.exitCode=1;}).finally(()=>db.end());

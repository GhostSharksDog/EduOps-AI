/** 全量OULAD独立核对：原CSV流式汇总，只读业务SQL，不创建/删除任何业务记录。 */
import {createReadStream} from 'node:fs';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parse} from 'csv-parse';
import type {LearningScope} from '../../src/shared/contracts/analysis';
import type {LearningAnalysis,LearningMetricCode} from '../../src/modules/analytics/contracts';
const args=process.argv.slice(2),option=(name:string,fallback='')=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw Error(name+'缺少参数');return value;};
const n=(value:string)=>{const result=Number(value);if(!Number.isFinite(result))throw Error('原CSV包含无法解析的数字');return result;},round=(value:number)=>Math.round(value*100)/100;
const missingCell=(value:string)=>value===''||value==='?';
const selectedCourses=option('--courses').split(',').filter(Boolean),requestedStart=option('--relative-start'),requestedEnd=option('--relative-end');
const requestedScope:LearningScope={courseKeys:[...new Set(selectedCourses)].sort(),...(requestedStart?{relativeDayStart:n(requestedStart)}:{}),...(requestedEnd?{relativeDayEnd:n(requestedEnd)}:{})};
const directory=path.resolve(option('--directory','datasets/raw/oulad')),output=path.resolve(option('--output',process.env.TEST_ARTIFACT_DIR?path.join(process.env.TEST_ARTIFACT_DIR,'full-learning-audit.json'):'../full-learning-audit.json'));
interface Source {file:string;kind:string;rows:number;sha256:string;bytes:number;modifiedAt:number;}
interface Trend {week:number;records:number;clicks:number;activeStudents:number;}
interface Audit {
 kind:'oulad-independent-audit-v1';sourceDirectory:string;license:string;source:string;learningScope:LearningScope;
 sources:Source[];metrics:{code:LearningMetricCode;value:number|null}[];metricDetails:Record<string,number>;
 relativeDayBounds:{min:number|null;max:number|null};activityDayBounds:{min:number|null;max:number|null};
 outsideActivityRange:{submissions:number;withdrawals:number};referenceErrors:{activityStudent:number;activityResource:number;submissionAssessment:number;submissionStudent:number};
 charts:{trend:Trend[];courses:LearningAnalysis['courses'];resources:LearningAnalysis['resources'];scores:LearningAnalysis['scores'];outcomes:LearningAnalysis['outcomes']};
 offlineScan:{durationMs:number;peakRssBytes:number};verifiedAt?:string;
 verification?:{passed:boolean;mismatches:string[];queryDurationMs:number;queryPeakRssBytes:number;complete:boolean;importedRows:number;expectedRows:number;datasetId:string;};
 storage?:{capturedAt:string;postgresRelations:{table:string;heapBytes:number;indexBytes:number;totalBytes:number}[];datasetMetadataRows:number;completedBatches:number;clickHouseActiveParts:{parts:number;physicalRows:number;bytesOnDisk:number;uncompressedBytes:number;compressedBytes:number};note:string;};
 process?:{pid:number;rssBytes:number;sampledPeakRssBytes:number;maxRssBytes:number;};
}
let peakRss=process.memoryUsage().rss;const memoryTimer=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss);},100);
async function scan():Promise<Audit>{
 const started=performance.now(),sources:Source[]=[],allCourses=new Map<string,string>(),students=new Set<number>(),roster=new Set<string>(),assessments=new Map<string,string>(),resourceTypes=new Map<string,string>();
 const chosen=(course:string)=>!requestedScope.courseKeys.length||requestedScope.courseKeys.includes(course),courseKey=(row:Record<string,string>)=>row.code_module+':'+row.code_presentation;
 const courseRows=new Map<string,{key:string;name:string;students:number;records:number;clicks:number;active:Set<number>}>(),outcomes=new Map<string,number>(),resources=new Map<string,number>();
 let minimum:number|null=null,maximum:number|null=null,activityMin:number|null=null,activityMax:number|null=null;
 const updateBounds=(day:number)=>{minimum=minimum===null?day:Math.min(minimum,day);maximum=maximum===null?day:Math.max(maximum,day);};
 const inRequested=(day:number)=>(requestedScope.relativeDayStart===undefined||day>=requestedScope.relativeDayStart)&&(requestedScope.relativeDayEnd===undefined||day<=requestedScope.relativeDayEnd);
 const manifest=JSON.parse(await readFile(path.join(directory,'../../manifests/oulad.json'),'utf8')) as {files:{file:string;rows:number;sha256:string}[]};
 async function file(file:string,kind:string,visit:(row:Record<string,string>)=>void){
  const filename=path.join(directory,file),before=await stat(filename),hash=createHash('sha256');let rows=0;
  const stream=createReadStream(filename);stream.on('data',data=>hash.update(data));const parser=stream.pipe(parse({columns:true,bom:true,skip_empty_lines:true,relax_column_count:false,max_record_size:65536}));stream.on('error',error=>parser.destroy(error));
  try{for await(const row of parser){rows++;visit(row as Record<string,string>);}}finally{stream.destroy();parser.destroy();}
  const after=await stat(filename);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error(file+'扫描期间发生变化');
  const source={file,kind,rows,sha256:hash.digest('hex'),bytes:before.size,modifiedAt:before.mtimeMs},declared=manifest.files.find(entry=>entry.file===file);
  if(!declared||declared.rows!==source.rows||declared.sha256!==source.sha256)throw Error(file+'原文件指纹或行数与来源说明不一致');sources.push(source);peakRss=Math.max(peakRss,process.memoryUsage().rss);console.log(file+'：'+rows.toLocaleString('en-US')+'行，独立指纹与来源一致');
 }
 await file('courses.csv','oulad_course',row=>{const key=courseKey(row);allCourses.set(key,row.code_module+' · '+row.code_presentation);if(chosen(key))courseRows.set(key,{key,name:allCourses.get(key)!,students:0,records:0,clicks:0,active:new Set()});});
 if(requestedScope.courseKeys.some(key=>!allCourses.has(key)))throw Error('核对范围包含原数据中不存在的课程批次');
 await file('studentInfo.csv','oulad_student',row=>{const course=courseKey(row);if(!chosen(course))return;const student=n(row.id_student);students.add(student);roster.add(course+':'+student);courseRows.get(course)!.students++;outcomes.set(row.final_result,(outcomes.get(row.final_result)??0)+1);});
 await file('assessments.csv','oulad_assessment',row=>{const course=courseKey(row);assessments.set(row.id_assessment,course);if(chosen(course)&&!missingCell(row.date))updateBounds(n(row.date));});
 await file('vle.csv','oulad_resource',row=>{resourceTypes.set(courseKey(row)+':'+row.id_site,row.activity_type);});
 const withdrawals=new Map<number,number>();
 await file('studentRegistration.csv','oulad_registration',row=>{if(!chosen(courseKey(row)))return;if(!missingCell(row.date_registration))updateBounds(n(row.date_registration));if(!missingCell(row.date_unregistration)){const day=n(row.date_unregistration);updateBounds(day);withdrawals.set(day,(withdrawals.get(day)??0)+1);}});
 const referenceErrors={activityStudent:0,activityResource:0,submissionAssessment:0,submissionStudent:0};
 const submitted=new Map<number,{rows:number;known:number;missing:number;banked:number;sum:number;scores:Map<string,number>}>();
 const scoreBin=(score:number)=>score<60?'低于60分':score<70?'60–69分':score<80?'70–79分':score<90?'80–89分':score<=100?'90–100分':'超出常规范围';
 await file('studentAssessment.csv','oulad_submission',row=>{const course=assessments.get(row.id_assessment);if(!course){referenceErrors.submissionAssessment++;return;}if(!chosen(course))return;if(!roster.has(course+':'+n(row.id_student)))referenceErrors.submissionStudent++;const day=n(row.date_submitted);updateBounds(day);const group=submitted.get(day)??{rows:0,known:0,missing:0,banked:0,sum:0,scores:new Map<string,number>()};group.rows++;if(n(row.is_banked)===1)group.banked++;else if(missingCell(row.score)){group.missing++;group.scores.set('缺失评分',(group.scores.get('缺失评分')??0)+1);}else{const score=n(row.score);group.known++;group.sum+=score;const label=scoreBin(score);group.scores.set(label,(group.scores.get(label)??0)+1);}submitted.set(day,group);});
 const activeStudents=new Set<number>(),activeDays=new Map<string,Map<number,number>>(),weeks=new Map<number,{week:number;records:number;clicks:number;active:Set<number>}>();let records=0,clicks=0,totalActiveDays=0;
 await file('studentVle.csv','oulad_activity',row=>{const course=courseKey(row);if(!chosen(course))return;const day=n(row.date);updateBounds(day);activityMin=activityMin===null?day:Math.min(activityMin,day);activityMax=activityMax===null?day:Math.max(activityMax,day);const student=n(row.id_student),pair=course+':'+student;if(!roster.has(pair))referenceErrors.activityStudent++;const resource=resourceTypes.get(course+':'+row.id_site);if(!resource)referenceErrors.activityResource++;if(!inRequested(day))return;
  const count=n(row.sum_click);records++;clicks+=count;activeStudents.add(student);const days=activeDays.get(pair)??new Map<number,number>(),word=Math.floor(day/32),mask=1<<(day-word*32),previous=days.get(word)??0;if((previous&mask)===0){days.set(word,previous|mask);totalActiveDays++;}activeDays.set(pair,days);
  const byCourse=courseRows.get(course)!;byCourse.records++;byCourse.clicks+=count;byCourse.active.add(student);const week=Math.floor(day/7),trend=weeks.get(week)??{week,records:0,clicks:0,active:new Set<number>()};trend.records++;trend.clicks+=count;trend.active.add(student);weeks.set(week,trend);const label=resource??'未知资源类型';resources.set(label,(resources.get(label)??0)+1);
 });
 let known=0,missing=0,banked=0,scoreSum=0,withdrawalCount=0,outsideSubmissions=0,outsideWithdrawals=0;const scoreCounts=new Map<string,number>();
 for(const [day,group]of submitted){if(activityMin!==null&&activityMax!==null&&(day<activityMin||day>activityMax))outsideSubmissions+=group.rows;if(!inRequested(day))continue;known+=group.known;missing+=group.missing;banked+=group.banked;scoreSum+=group.sum;for(const [label,count]of group.scores)scoreCounts.set(label,(scoreCounts.get(label)??0)+count);}
 for(const [day,count]of withdrawals){if(activityMin!==null&&activityMax!==null&&(day<activityMin||day>activityMax))outsideWithdrawals+=count;if(inRequested(day))withdrawalCount+=count;}
 const scope:LearningScope={...requestedScope};scope.relativeDayStart??=minimum===null?undefined:Math.min(minimum,scope.relativeDayEnd??minimum);scope.relativeDayEnd??=maximum===null?undefined:Math.max(maximum,requestedScope.relativeDayStart??maximum);
 const metrics:{code:LearningMetricCode;value:number|null}[]=[{code:'student_count',value:students.size},{code:'enrollment_count',value:roster.size},{code:'activity_count',value:records},{code:'click_count',value:clicks},{code:'active_student_count',value:activeStudents.size},{code:'average_active_days',value:roster.size?round(totalActiveDays/roster.size):null},{code:'average_score',value:known?round(scoreSum/known):null},{code:'withdrawal_count',value:withdrawalCount}];
 const charts={trend:[...weeks.values()].map(row=>({week:row.week,records:row.records,clicks:row.clicks,activeStudents:row.active.size})).sort((a,b)=>a.week-b.week),courses:[...courseRows.values()].map(row=>({key:row.key,name:row.name,students:row.students,records:row.records,clicks:row.clicks,activeStudents:row.active.size})).sort((a,b)=>a.key.localeCompare(b.key)),resources:[...resources].map(([label,count])=>({label,count})),scores:[...scoreCounts].map(([label,count])=>({label,count})),outcomes:[...outcomes].map(([label,count])=>({label,count}))};
 const audit:Audit={kind:'oulad-independent-audit-v1',sourceDirectory:directory,license:'CC BY 4.0',source:'https://archive.ics.uci.edu/dataset/349/open+university+learning+analytics+dataset',learningScope:scope,sources,metrics,metricDetails:{activeEnrollmentCount:activeDays.size,totalActiveDays,enrollmentCount:roster.size,inactiveEnrollmentCount:roster.size-activeDays.size,knownScores:known,missingScores:missing,bankedSubmissions:banked,eligibleSubmissions:known+missing},relativeDayBounds:{min:minimum,max:maximum},activityDayBounds:{min:activityMin,max:activityMax},outsideActivityRange:{submissions:outsideSubmissions,withdrawals:outsideWithdrawals},referenceErrors,charts,offlineScan:{durationMs:Math.round(performance.now()-started),peakRssBytes:peakRss}};
 activeDays.clear();weeks.clear();return audit;
}
async function main(){
 const expectedFile=option('--expected-file');let audit:Audit=expectedFile?JSON.parse(await readFile(path.resolve(expectedFile),'utf8')):await scan();
 if(audit.kind!=='oulad-independent-audit-v1')throw Error('独立核对文件版本不正确');
 if(!args.includes('--csv-only')){
  const datasetId=option('--dataset-id');if(!/^[0-9a-f-]{36}$/i.test(datasetId))throw Error('只读数据库核对必须显式提供--dataset-id');
  const {config:loadEnv}=await import('dotenv');loadEnv({path:'.env.local',quiet:true});loadEnv({quiet:true});
  const pg=new URL(process.env.DATABASE_URL??'');const safePg=(pg.port==='15434'&&pg.pathname==='/metadata_dev')||(pg.port==='25432'&&pg.pathname==='/education_cleanup_test');
  const chRaw=process.env.CLICKHOUSE_HOST??'',ch=new URL(/^https?:\/\//.test(chRaw)?chRaw:`http://${chRaw}:${process.env.CLICKHOUSE_PORT??8123}`),chPort=Number(ch.port);if(!['127.0.0.1','localhost'].includes(pg.hostname)||!safePg||!['127.0.0.1','localhost'].includes(ch.hostname)||!(pg.port==='15434'?chPort===18123:chPort===28123&&process.env.CLICKHOUSE_DATABASE==='education_cleanup_test'))throw Error('全量只读核对只允许本机明确的业务或专用测试端口');
  const org=option('--organization-id',process.env.SYSTEM_USER_ID??'6f40f555-5f1b-4d1f-807c-b209e817bfdd');if(!/^[0-9a-f-]{36}$/i.test(org))throw Error('核对机构编号无效');
  for(const source of audit.sources){const current=await stat(path.join(audit.sourceDirectory,source.file));if(current.size!==source.bytes||current.mtimeMs!==source.modifiedAt)throw Error(source.file+'在独立扫描之后发生变化，请重新扫描');}
  const {learningAnalytics}=await import('../../src/modules/analytics/server'),{db}=await import('../../src/platform/database');
  const queryStarted=performance.now();peakRss=process.memoryUsage().rss;
  try{
   const result=await learningAnalytics.query(datasetId,{...audit.learningScope,organizationId:org}),mismatches:string[]=[];
   for(const expected of audit.metrics){const actual=result.metrics.find(metric=>metric.code===expected.code);if(actual?.value!==expected.value)mismatches.push(expected.code+': expected '+expected.value+', actual '+actual?.value);}
   const canonical=(rows:unknown[])=>JSON.stringify([...rows].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
   for(const key of ['trend','courses','resources','scores','outcomes'] as const)if(canonical(result[key])!==canonical(audit.charts[key]))mismatches.push(key+'图表聚合与原CSV不一致');
   for(const source of audit.sources){const actual=result.completeness.find(row=>row.kind===source.kind);if(actual?.rows!==source.rows||actual.expected!==source.rows||actual.status!=='complete')mismatches.push(source.kind+'全量导入/期望行数不一致');}
   const avg=result.metrics.find(metric=>metric.code==='average_active_days')?.details,score=result.metrics.find(metric=>metric.code==='average_score')?.details;
   for(const [key,value]of Object.entries(audit.metricDetails))if((avg?.[key]??score?.[key])!==value)mismatches.push(key+'计算依据不一致');
   if(JSON.stringify(result.relativeDayBounds)!==JSON.stringify(audit.relativeDayBounds))mismatches.push('全量相对日期范围不一致');
   if(Object.values(audit.referenceErrors).some(count=>count!==0))mismatches.push('原CSV发现缺失关联');
   const queryDurationMs=Math.round(performance.now()-queryStarted),queryPeakRssBytes=Math.max(peakRss,process.memoryUsage().rss);
   const relations=await db.query<{table:string;heap_bytes:string;index_bytes:string;total_bytes:string}>(`SELECT c.relname AS table,pg_relation_size(c.oid) AS heap_bytes,pg_indexes_size(c.oid) AS index_bytes,pg_total_relation_size(c.oid) AS total_bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`,[['education_dataset','education_import_batch','education_record']]);
   const metadataRows=await db.query<{count:string}>('SELECT count(*) AS count FROM education_record WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid',[org,datasetId]);
   const {EducationEventsClient}=await import('../../src/platform/database/education-events');const raw=await new EducationEventsClient().execute(`SELECT count() AS parts,sum(rows) AS physical_rows,sum(bytes_on_disk) AS bytes_on_disk,sum(data_uncompressed_bytes) AS uncompressed_bytes,sum(data_compressed_bytes) AS compressed_bytes FROM system.parts WHERE database=currentDatabase() AND table='education_events_v1' AND active FORMAT JSONEachRow`),parts=JSON.parse(raw.trim()) as Record<string,unknown>;
   const storage={capturedAt:new Date().toISOString(),postgresRelations:relations.rows.map(row=>({table:row.table,heapBytes:Number(row.heap_bytes),indexBytes:Number(row.index_bytes),totalBytes:Number(row.total_bytes)})),datasetMetadataRows:Number(metadataRows.rows[0].count),completedBatches:result.batches.length,clickHouseActiveParts:{parts:Number(parts.parts),physicalRows:Number(parts.physical_rows),bytesOnDisk:Number(parts.bytes_on_disk),uncompressedBytes:Number(parts.uncompressed_bytes),compressedBytes:Number(parts.compressed_bytes)},note:'PostgreSQL关系和ClickHouse active parts是整个当前数据库教育表的实际占用，可能包含其他数据集；物理行含ReplacingMergeTree尚未合并版本，不等同于完成批次的逻辑导入行数。'};
   audit={...audit,verifiedAt:new Date().toISOString(),verification:{passed:mismatches.length===0,mismatches,queryDurationMs,queryPeakRssBytes,complete:result.completeness.every(row=>row.status==='complete'),importedRows:result.completeness.reduce((total,row)=>total+row.rows,0),expectedRows:audit.sources.reduce((total,row)=>total+row.rows,0),datasetId},storage,process:{pid:process.pid,rssBytes:process.memoryUsage().rss,sampledPeakRssBytes:Math.max(peakRss,process.memoryUsage().rss),maxRssBytes:process.resourceUsage().maxRSS*1024}};
  }finally{await db.end();}
 }
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(audit,null,2)+'\n');
 console.log(JSON.stringify({metrics:audit.metrics,outsideActivityRange:audit.outsideActivityRange,relativeDayBounds:audit.relativeDayBounds,offlineScan:audit.offlineScan,verification:audit.verification,output}));
 if(audit.verification&&!audit.verification.passed)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'全量独立核对失败');process.exitCode=1;}).finally(()=>clearInterval(memoryTimer));

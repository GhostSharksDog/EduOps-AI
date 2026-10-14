import 'server-only';
import {queryOne,queryRows} from '@/platform/database';
import {EducationEventsClient,clickHouseArray} from '@/platform/database/education-events';
import type {AuthorizedLearningScope} from '@/shared/contracts/analysis';
import type {DatasetVO,ImportResultVO} from '@/modules/education/contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';

export interface LearningContext {dataset:DatasetVO;batches:ImportResultVO[];}
export interface LearningCourse {key:string;name:string;}
export interface LearningMetadata {
 students:number;enrollments:number;withdrawals:number;courseStudents:Record<string,number>;
 outcomes:{label:string;count:number}[];assessmentIds:string[];resourceTypes:Record<string,string>;
}
export interface LearningActivities {
 records:number;clicks:number;activeStudents:number;activeEnrollmentCount:number;activeDaySum:number;
 trend:{week:number;records:number;clicks:number;activeStudents:number}[];
 courses:{key:string;records:number;clicks:number;activeStudents:number}[];
 resources:{key:string;count:number}[];
}
export interface LearningSubmissions {average:number|null;known:number;missing:number;banked:number;eligible:number;scores:{label:string;count:number}[];}
export interface LearningRepositoryPort {
 context(org:string,datasetId:string):Promise<LearningContext>;
 courses(context:LearningContext,org:string):Promise<LearningCourse[]>;
 bounds(context:LearningContext,scope:AuthorizedLearningScope):Promise<{min:number|null;max:number|null}>;
 metadata(context:LearningContext,scope:AuthorizedLearningScope):Promise<LearningMetadata>;
 activities(context:LearningContext,scope:AuthorizedLearningScope):Promise<LearningActivities>;
 submissions(context:LearningContext,scope:AuthorizedLearningScope,assessmentIds:string[]):Promise<LearningSubmissions>;
}
const number=(value:unknown)=>{const result=Number(value??0);if(!Number.isFinite(result)||Math.abs(result)>Number.MAX_SAFE_INTEGER)throw new Error('学习聚合结果超出可表示范围');return result;};
const has=(context:LearningContext,kind:string)=>context.batches.some(b=>b.kind===kind);
const settings='SETTINGS max_threads=2,max_memory_usage=1000000000,max_bytes_before_external_group_by=134217728';

/** 公开学习数据仅由SQL汇总；不调用教育快照或返回行为事件明细。 */
export class LearningRepository implements LearningRepositoryPort {
 constructor(private events=new EducationEventsClient()){}
 async context(org:string,datasetId:string):Promise<LearningContext>{
  const dataset=await queryOne<Omit<DatasetVO,'createdAt'|'dataCutoff'>&{createdAt:Date;dataCutoff:Date}>('SELECT * FROM education_dataset WHERE id=$1::uuid AND "organizationId"=$2::uuid',[datasetId,org]);
  if(!dataset)throw new WorkflowError('数据集不存在或无权访问',404);
  const batches=await queryRows<Omit<ImportResultVO,'createdAt'|'completedAt'>&{createdAt:Date;completedAt:Date|null}>('SELECT * FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND status=$3 ORDER BY id',[org,datasetId,'completed']);
  return {dataset:{...dataset,sourceUrl:dataset.sourceUrl??undefined,createdAt:dataset.createdAt.toISOString(),dataCutoff:dataset.dataCutoff.toISOString()},batches:batches.map(b=>({...b,createdAt:b.createdAt.toISOString(),completedAt:b.completedAt?.toISOString()??null}))};
 }
 private pgParameters(context:LearningContext,scope:AuthorizedLearningScope):unknown[]{return [scope.organizationId,context.dataset.id,context.batches.map(b=>b.id),scope.courseKeys,scope.relativeDayStart??null,scope.relativeDayEnd??null];}
 private pgFilter='"organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "batchId"=ANY($3::uuid[])';
 private courseFilter='(cardinality($4::text[])=0 OR "courseId"=ANY($4::text[]))';
 async courses(context:LearningContext,org:string):Promise<LearningCourse[]>{
  if(!has(context,'oulad_course'))return [];
  const rows=await queryRows<{key:string;name:string}>(`SELECT "courseId" AS key, (payload->>'code_module') || ' · ' || (payload->>'code_presentation') AS name FROM education_record WHERE ${this.pgFilter} AND kind='oulad_course' ORDER BY "courseId" LIMIT 1001`,[org,context.dataset.id,context.batches.map(b=>b.id)]);
  if(rows.length>1000)throw new WorkflowError('课程批次数量超出本次公开数据分析限制',400);
  return rows;
 }
 private eventParameters(context:LearningContext,scope:AuthorizedLearningScope,kind:string):Record<string,string>{return {org:scope.organizationId,dataset:context.dataset.id,batches:clickHouseArray(context.batches.filter(b=>b.kind===kind).map(b=>b.id)),courses:clickHouseArray(scope.courseKeys),start:String(scope.relativeDayStart??-2147483648),end:String(scope.relativeDayEnd??2147483647)};}
 private eventFilter='organization_id={org:UUID} AND dataset_id={dataset:UUID} AND batch_id IN {batches:Array(UUID)}';
 private eventCourseFilter='(empty({courses:Array(String)}) OR course_id IN {courses:Array(String)})';
 async bounds(context:LearningContext,scope:AuthorizedLearningScope){
  // 默认覆盖完整已导入学习范围，不能以点击活动的结束日截掉晚交测评或退出。
  const metadata=await queryOne<{min:unknown;max:unknown}>(`SELECT min(d.day) AS min,max(d.day) AS max FROM education_record CROSS JOIN LATERAL (VALUES ((payload->>'date_registration')::integer),((payload->>'date_unregistration')::integer),((payload->>'date')::integer)) AS d(day) WHERE ${this.pgFilter} AND ${this.courseFilter} AND kind=ANY($5::text[])`,[...this.pgParameters(context,scope).slice(0,4),['oulad_registration','oulad_assessment']]);
  const mins:number[]=[],maxs:number[]=[];if(metadata?.min!=null)mins.push(number(metadata.min));if(metadata?.max!=null)maxs.push(number(metadata.max));
  const eventBatches=context.batches.filter(b=>['oulad_activity','oulad_submission'].includes(b.kind)).map(b=>b.id);
  if(eventBatches.length){const parameters={...this.eventParameters(context,scope,'oulad_activity'),batches:clickHouseArray(eventBatches)};const [row]=await this.events.queryRows(`SELECT minOrNull(relative_day) AS min,maxOrNull(relative_day) AS max FROM education_events_v1 FINAL WHERE ${this.eventFilter} AND kind IN ('oulad_activity','oulad_submission') AND ${this.eventCourseFilter} ${settings}`,parameters);if(row?.min!=null)mins.push(number(row.min));if(row?.max!=null)maxs.push(number(row.max));}
  return {min:mins.length?Math.min(...mins):null,max:maxs.length?Math.max(...maxs):null};
 }
 async metadata(context:LearningContext,scope:AuthorizedLearningScope):Promise<LearningMetadata>{
  const parameters=this.pgParameters(context,scope),filter=`${this.pgFilter} AND ${this.courseFilter}`;
  // 所有学员计数和分布由PostgreSQL计算，资源/测评只返回有界的字典，不返回完整payload。
  const summary=await queryOne<{students:unknown;enrollments:unknown;withdrawals:unknown}>(`SELECT count(DISTINCT "studentId") FILTER (WHERE kind='oulad_student') AS students,count(*) FILTER (WHERE kind='oulad_student') AS enrollments,count(*) FILTER (WHERE kind='oulad_registration' AND payload->>'date_unregistration' IS NOT NULL AND ($5::integer IS NULL OR (payload->>'date_unregistration')::integer >= $5) AND ($6::integer IS NULL OR (payload->>'date_unregistration')::integer <= $6)) AS withdrawals FROM education_record WHERE ${filter} AND kind=ANY($7::text[])`,[...parameters,['oulad_student','oulad_registration']]);
  const groups=await queryRows<{key:string;label:string;count:unknown}>(`SELECT "courseId" AS key,payload->>'final_result' AS label,count(*) AS count FROM education_record WHERE ${filter} AND kind='oulad_student' GROUP BY "courseId",payload->>'final_result' ORDER BY "courseId",label`,parameters.slice(0,4));
  const courseStudents:Record<string,number>={},outcomes=new Map<string,number>();
  for(const row of groups){const count=number(row.count);courseStudents[row.key]=(courseStudents[row.key]??0)+count;outcomes.set(row.label??'缺失最终结果',(outcomes.get(row.label??'缺失最终结果')??0)+count);}
  const dictionary=await queryOne<{assessments:string[]|null;resources:Record<string,string>|null}>(`SELECT array_agg(payload->>'id_assessment') FILTER (WHERE kind='oulad_assessment') AS assessments,jsonb_object_agg("courseId" || ':' || (payload->>'id_site'),payload->>'activity_type') FILTER (WHERE kind='oulad_resource') AS resources FROM education_record WHERE ${filter} AND kind=ANY($5::text[])`,[...parameters.slice(0,4),['oulad_assessment','oulad_resource']]);
  if((dictionary?.assessments?.length??0)>10000||Object.keys(dictionary?.resources??{}).length>20000)throw new WorkflowError('公开学习维表规模超出本次查询限制',400);
  return {students:number(summary?.students),enrollments:number(summary?.enrollments),withdrawals:number(summary?.withdrawals),courseStudents,outcomes:[...outcomes].map(([label,count])=>({label,count})),assessmentIds:[...new Set(dictionary?.assessments??[])],resourceTypes:dictionary?.resources??{}};
 }
 async activities(context:LearningContext,scope:AuthorizedLearningScope):Promise<LearningActivities>{
  const empty:LearningActivities={records:0,clicks:0,activeStudents:0,activeEnrollmentCount:0,activeDaySum:0,trend:[],courses:[],resources:[]};
  if(!has(context,'oulad_activity'))return empty;
  const parameters=this.eventParameters(context,scope,'oulad_activity');
  const filter=`${this.eventFilter} AND kind='oulad_activity' AND ${this.eventCourseFilter} AND relative_day BETWEEN {start:Int32} AND {end:Int32}`;
  // GROUPING SETS一遍扫描生成总数、课程、周、资源汇总；精确去重不把各组百分比或人数简单相加。
  const rows=await this.events.queryRows(`WITH selected AS (SELECT course_id,student_id,toInt32(floor(relative_day/7)) AS week,JSONExtractString(payload,'id_site') AS resource_id,JSONExtractFloat(payload,'sum_click') AS clicks FROM education_events_v1 FINAL WHERE ${filter}) SELECT GROUPING(course_id) AS grouped_course,GROUPING(week) AS grouped_week,GROUPING(resource_id) AS grouped_resource,course_id,week,resource_id,count() AS records,sum(clicks) AS clicks,uniqExact(student_id) AS active_students FROM selected GROUP BY GROUPING SETS ((),(course_id),(week),(course_id,resource_id)) ${settings}`,parameters);
  if(rows.length>22000)throw new WorkflowError('学习图表汇总规模超出本次查询限制',400);
  for(const row of rows){
   const course=number(row.grouped_course)===0,week=number(row.grouped_week)===0,resource=number(row.grouped_resource)===0;
   const values={records:number(row.records),clicks:number(row.clicks),activeStudents:number(row.active_students)};
   if(!course&&!week&&!resource)Object.assign(empty,values);
   else if(week)empty.trend.push({week:number(row.week),...values});
   else if(course&&resource)empty.resources.push({key:String(row.course_id)+':'+String(row.resource_id),count:values.records});
   else if(course)empty.courses.push({key:String(row.course_id),...values});
  }
  const [active]=await this.events.queryRows(`SELECT count() AS active_enrollment_count,sum(days) AS active_day_sum FROM (SELECT course_id,student_id,uniqExact(relative_day) AS days FROM education_events_v1 FINAL WHERE ${filter} GROUP BY course_id,student_id) ${settings}`,parameters);
  empty.activeEnrollmentCount=number(active?.active_enrollment_count);empty.activeDaySum=number(active?.active_day_sum);
  empty.trend.sort((a,b)=>a.week-b.week);empty.courses.sort((a,b)=>a.key.localeCompare(b.key));
  return empty;
 }
 async submissions(context:LearningContext,scope:AuthorizedLearningScope,assessmentIds:string[]):Promise<LearningSubmissions>{
  const empty:LearningSubmissions={average:null,known:0,missing:0,banked:0,eligible:0,scores:[]};
  if(!has(context,'oulad_submission')||!assessmentIds.length)return empty;
  const parameters={...this.eventParameters(context,scope,'oulad_submission'),assessments:clickHouseArray(assessmentIds)};
  const rows=await this.events.queryRows(`WITH selected AS (SELECT JSONExtractFloat(payload,'is_banked') AS banked,toFloat64OrNull(JSONExtractRaw(payload,'score')) AS score FROM education_events_v1 FINAL WHERE ${this.eventFilter} AND kind='oulad_submission' AND JSONExtractString(payload,'id_assessment') IN {assessments:Array(String)} AND relative_day BETWEEN {start:Int32} AND {end:Int32}),binned AS (SELECT *,if(banked=1,'免修提交（排除）',multiIf(isNull(score),'缺失评分',score<60,'低于60分',score<70,'60–69分',score<80,'70–79分',score<90,'80–89分',score<=100,'90–100分','超出常规范围')) AS label FROM selected) SELECT GROUPING(label) AS grouped,label,countIf(banked!=1 AND isNotNull(score)) AS known,countIf(banked!=1 AND isNull(score)) AS missing,countIf(banked=1) AS banked_count,countIf(banked!=1) AS eligible,if(countIf(banked!=1 AND isNotNull(score))=0,NULL,avgIf(score,banked!=1 AND isNotNull(score))) AS average,count() AS count FROM binned GROUP BY GROUPING SETS ((),(label)) ${settings}`,parameters);
  for(const row of rows){if(number(row.grouped)===1){Object.assign(empty,{average:row.average==null?null:number(row.average),known:number(row.known),missing:number(row.missing),banked:number(row.banked_count),eligible:number(row.eligible)});}else if(row.label!=='免修提交（排除）')empty.scores.push({label:String(row.label),count:number(row.count)});}
  const order=['低于60分','60–69分','70–79分','80–89分','90–100分','缺失评分','超出常规范围'];empty.scores.sort((a,b)=>order.indexOf(a.label)-order.indexOf(b.label));return empty;
 }
}

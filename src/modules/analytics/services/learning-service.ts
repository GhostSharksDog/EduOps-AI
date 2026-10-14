import 'server-only';
import {createHash} from 'node:crypto';
import {learningScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedLearningScope,EvidenceReference} from '@/shared/contracts/analysis';
import {kindLabels,datasetAnalysisType} from '@/modules/education/contracts';
import type {RecordKind} from '@/modules/education/contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {LearningAnalysis,LearningMetric,LearningMetricCode} from '../contracts/learning';
import {learningMetricLabels,learningMetricDefinitions} from '../contracts/learning';
import type {LearningContext,LearningCourse,LearningRepositoryPort} from '../repositories/learning-repository';

export const learningKinds=['oulad_course','oulad_student','oulad_registration','oulad_assessment','oulad_resource','oulad_activity','oulad_submission'] as const satisfies readonly RecordKind[];
const round=(value:number)=>Math.round(value*100)/100;
/** 固定两个并发任务；避免全量公开数据的多个聚合同时占满本机内存。 */
async function bounded<T>(tasks:(()=>Promise<T>)[]):Promise<T[]>{
 const results:T[]=[];let next=0;
 await Promise.all(Array.from({length:Math.min(2,tasks.length)},async()=>{while(next<tasks.length){const index=next++;results[index]=await tasks[index]();}}));
 return results;
}
export class LearningAnalyticsService {
 constructor(private repository:LearningRepositoryPort){}
 private async resolve(datasetId:string,input:AuthorizedLearningScope):Promise<{context:LearningContext;scope:AuthorizedLearningScope;courses:LearningCourse[];bounds:{min:number|null;max:number|null}}>{
  const parsed=learningScopeSchema.parse({courseKeys:input.courseKeys,relativeDayStart:input.relativeDayStart,relativeDayEnd:input.relativeDayEnd});
  const loaded=await this.repository.context(input.organizationId,datasetId),context={...loaded,batches:loaded.batches.filter(b=>b.status==='completed')};
  if(datasetAnalysisType(context.dataset)!=='learning')throw new WorkflowError('学习分析仅支持独立的OULAD公开数据集，请切换数据集',400);
  const courses=await this.repository.courses(context,input.organizationId);
  const keys=[...new Set(parsed.courseKeys)].sort(),allowed=new Set(courses.map(c=>c.key));
  if(keys.some(key=>!allowed.has(key)))throw new WorkflowError('课程批次不存在或未完成导入，不能扩大当前数据集范围',400);
  const scope:AuthorizedLearningScope={...parsed,courseKeys:keys,organizationId:input.organizationId};
  const bounds=await this.repository.bounds(context,scope);
  // 单侧指定的范围也可能完全位于已导入数据之外，仍保留合法的真实零结果查询。
  scope.relativeDayStart??=bounds.min===null?undefined:Math.min(bounds.min,parsed.relativeDayEnd??bounds.min);
  scope.relativeDayEnd??=bounds.max===null?undefined:Math.max(bounds.max,parsed.relativeDayStart??bounds.max);
  return {context,scope,courses:courses.filter(c=>!keys.length||keys.includes(c.key)),bounds};
 }
 async resolveScope(datasetId:string,input:AuthorizedLearningScope):Promise<AuthorizedLearningScope>{return (await this.resolve(datasetId,input)).scope;}
 async query(datasetId:string,input:AuthorizedLearningScope):Promise<LearningAnalysis>{
  const {context,scope,courses,bounds}=await this.resolve(datasetId,input);
  const metadata=await this.repository.metadata(context,scope);
  const [activities,submissions]=await bounded<Awaited<ReturnType<LearningRepositoryPort['activities']>>|Awaited<ReturnType<LearningRepositoryPort['submissions']>>>([
   ()=>this.repository.activities(context,scope),()=>this.repository.submissions(context,scope,metadata.assessmentIds),
  ]);
  const activity=activities as Awaited<ReturnType<LearningRepositoryPort['activities']>>,submission=submissions as Awaited<ReturnType<LearningRepositoryPort['submissions']>>;
  const has=(kind:RecordKind)=>context.batches.some(b=>b.kind===kind);
  const completeness=learningKinds.map(kind=>{const rows=context.batches.filter(b=>b.kind===kind).reduce((sum,b)=>sum+b.acceptedRows,0),expected=context.dataset.expectedRows?.[kind]??null;return {kind,name:kindLabels[kind],rows,expected,status:!has(kind)?'missing' as const:expected!==null&&rows===expected?'complete' as const:'partial' as const};});
  const metric=(code:LearningMetricCode,value:number|null,unit:LearningMetric['unit'],dependencies:RecordKind[],details?:Record<string,number>,unavailable?:string):LearningMetric=>{
   const absent=dependencies.filter(kind=>!has(kind));
   const missing=absent.length?`尚无已完成的${absent.map(kind=>kindLabels[kind]).join('、')}批次`:value===null?(unavailable??'当前范围没有可计算的对象'):undefined;
   const partial=dependencies.some(kind=>completeness.find(c=>c.kind===kind)?.status!=='complete');
   return {code,label:learningMetricLabels[code],value:missing?null:value,unit,status:missing?'insufficient_data':'ready',reason:missing??(learningMetricDefinitions[code]+(partial?'；仅基于已完成导入批次统计，公开数据尚未完成全量接入':'')),details};
  };
  const completeMean=['oulad_student','oulad_activity'].every(kind=>completeness.find(c=>c.kind===kind)?.status==='complete');
  const averageDays=completeMean&&metadata.enrollments>0&&activity.activeEnrollmentCount<=metadata.enrollments?round(activity.activeDaySum/metadata.enrollments):null;
  const metrics:LearningMetric[]=[
   metric('student_count',metadata.students,'人',['oulad_course','oulad_student']),
   metric('enrollment_count',metadata.enrollments,'条',['oulad_course','oulad_student']),
   metric('activity_count',activity.records,'条',['oulad_course','oulad_activity']),
   metric('click_count',activity.clicks,'次',['oulad_course','oulad_activity']),
   metric('active_student_count',activity.activeStudents,'人',['oulad_course','oulad_activity']),
   metric('average_active_days',averageDays,'天',['oulad_course','oulad_student','oulad_activity'],{activeEnrollmentCount:activity.activeEnrollmentCount,totalActiveDays:activity.activeDaySum,enrollmentCount:metadata.enrollments,inactiveEnrollmentCount:Math.max(0,metadata.enrollments-activity.activeEnrollmentCount)},!completeMean?'学员课程名册或学习活动尚未完成全量导入，不能给出完整平均活跃天数':metadata.enrollments===0?'所选课程批次没有学员课程记录，平均值留空':'活动对应的学员课程记录不完整，不能计算平均活跃天数'),
   metric('average_score',submission.average===null?null:round(submission.average),'分',['oulad_course','oulad_assessment','oulad_submission'],{knownScores:submission.known,missingScores:submission.missing,bankedSubmissions:submission.banked,eligibleSubmissions:submission.eligible},'当前相对日范围没有非免修且评分已知的测评提交，平均值留空'),
   metric('withdrawal_count',metadata.withdrawals,'条',['oulad_course','oulad_registration']),
  ];
  const resourceCounts=new Map<string,number>();for(const row of activity.resources){const label=metadata.resourceTypes[row.key]??'未知资源类型';resourceCounts.set(label,(resourceCounts.get(label)??0)+row.count);}
  const batches=context.batches.map(b=>({id:b.id,kind:b.kind,rows:b.acceptedRows,hash:b.fileHash})).sort((a,b)=>a.id.localeCompare(b.id));
  const publicScope={courseKeys:scope.courseKeys,relativeDayStart:scope.relativeDayStart,relativeDayEnd:scope.relativeDayEnd};
  const version=createHash('sha256').update(JSON.stringify({datasetId,schemaVersion:context.dataset.schemaVersion,expectedRows:Object.fromEntries(Object.entries(context.dataset.expectedRows??{}).sort(([a],[b])=>a.localeCompare(b))),scope:publicScope,batches})).digest('hex');
  const updatedAt=context.batches.map(b=>b.completedAt??b.createdAt).sort().at(-1)??context.dataset.createdAt;
  const evidence:EvidenceReference[]=metrics.map(m=>({id:`learning:${datasetId}:${m.code}:${version.slice(0,12)}`,kind:'metric',sourceId:datasetId,version:'oulad-learning-v1/'+version,summary:`${m.label}：${m.value===null?'数据不足（'+m.reason+'）':m.value+m.unit}；按课程批次与相对日统计，不属于教培经营流水`,learningScope:publicScope,updatedAt}));
  return {dataset:context.dataset,scope,metrics,trend:has('oulad_activity')?activity.trend:[],courses:has('oulad_student')&&has('oulad_activity')?courses.map(course=>({key:course.key,name:course.name,students:metadata.courseStudents[course.key]??0,records:activity.courses.find(c=>c.key===course.key)?.records??0,clicks:activity.courses.find(c=>c.key===course.key)?.clicks??0,activeStudents:activity.courses.find(c=>c.key===course.key)?.activeStudents??0})):[],resources:[...resourceCounts].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count),scores:submission.scores,outcomes:metadata.outcomes,completeness,evidence,batches,relativeDayBounds:bounds};
 }
}

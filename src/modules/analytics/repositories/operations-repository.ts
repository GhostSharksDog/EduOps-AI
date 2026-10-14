import 'server-only';
import {EducationEventsClient,clickHouseArray} from '@/platform/database/education-events';
import {educationData} from '@/modules/education/server';
import {buildChannelAttribution,channelName,unknownChannelId,validOperationalContract,completeKinds,type EducationSnapshot,type StoredEducationRow,type AttendanceCounts,type AttendanceFactsVO,type StudentAttendanceVO} from '@/modules/education/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import type {OperationalAggregateInput} from '../domain/operations';
import type {ChannelFunnel} from '../contracts';

export interface PreparedOperations {snapshot:EducationSnapshot;organizationId:string;summaries?:Map<string,Promise<DatabaseOperationResult>>;}
export interface DatabaseOperationResult {snapshot:EducationSnapshot;aggregate:OperationalAggregateInput;funnel:ChannelFunnel;}
const milliseconds=(value:unknown)=>Date.parse(String(value));
const date=(value:string)=>value.replace('T',' ').replace('Z','');
const empty=():AttendanceCounts=>({due:0,present:0,absent:0,leave:0,unknown:0});
const jsonRows=(rows:unknown[])=>clickHouseArray(rows.map(r=>JSON.stringify(r)));
const base=`organization_id={org:UUID} AND dataset_id={dataset:UUID} AND batch_id IN {batches:Array(UUID)}`;
const eventDate=(field:string)=>`parseDateTime64BestEffortOrNull(JSONExtractString(payload,'${field}'),3,'UTC')`;
const scoped=`(empty({campuses:Array(String)}) OR campus_id IN {campuses:Array(String)}) AND (empty({courses:Array(String)}) OR course_id IN {courses:Array(String)}) AND (empty({authorized:Array(String)}) OR campus_id IN {authorized:Array(String)})`;
const dayRange=`toDate(occurred_at,'Asia/Shanghai') BETWEEN toDate({start:String}) AND toDate({end:String}) AND occurred_at<={cutoff:DateTime64(3,'UTC')}`;
const selected=(scope:AuthorizedScope,r:StoredEducationRow)=>(!scope.campusIds.length||scope.campusIds.includes(r.campusId))&&(!scope.courseIds.length||scope.courseIds.includes(r.courseId))&&(!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.campusId));
const numeric=(value:unknown)=>Number(value??0);

/**
 * 行为明细留在 ClickHouse。Node 只接收每个学员/课程/月的签到计数、
 * 每份合约的净账本及有限维度汇总；批次列表来自同一准备快照。
 */
export class OperationsRepository {
 constructor(private events=new EducationEventsClient()){}
 async prepare(organizationId:string,id:string):Promise<PreparedOperations>{
  const snapshot=await educationData.snapshot(organizationId,id,['campus','course','student','class','enrollment','contract']);
  const p=this.parameters({snapshot,organizationId});
  const contracts=snapshot.records.filter(r=>r.kind==='contract'),leadIds=[...new Set(contracts.flatMap(r=>typeof r.payload.leadId==='string'?[r.payload.leadId]:[]))];
  // 首购归属只需要合约明确关联的线索，而非整张百万线索表。
  if(leadIds.length){const rows=await this.events.queryRows(`SELECT * FROM education_events_v1 FINAL WHERE ${base} AND kind='lead' AND source_id IN {leadIds:Array(String)}`,{...p,leadIds:clickHouseArray(leadIds)});snapshot.records.push(...rows.map(r=>this.row(r)));}
  // 同一续费关联的最早时间足以检查链完整性；原始事件仍留在库中。
  const nextIds=contracts.map(r=>r.sourceId);
  if(nextIds.length){const rows=await this.events.queryRows(`SELECT JSONExtractString(payload,'contractId') old_id,JSONExtractString(payload,'newContractId') new_id,JSONExtractString(payload,'studentId') sid,min(occurred_at) first_at FROM education_events_v1 FINAL WHERE ${base} AND kind='renewal' AND JSONExtractString(payload,'newContractId') IN {nextIds:Array(String)} GROUP BY old_id,new_id,sid`,{...p,nextIds:clickHouseArray(nextIds)});snapshot.records.push(...rows.map((r,i)=>this.synthetic('renewal','chain-'+i,{contractId:r.old_id,newContractId:r.new_id,studentId:r.sid},this.iso(r.first_at))));}
  const complaintContexts=await this.events.queryRows(`SELECT student_id,campus_id,course_id,min(occurred_at) first_at FROM education_events_v1 FINAL WHERE ${base} AND kind='complaint' AND occurred_at IS NOT NULL GROUP BY student_id,campus_id,course_id`,p);
  // 只用于渠道上下文集合，不能作为标签/个人画像的客诉次数或原文。
  snapshot.records.push(...complaintContexts.map((r,i)=>this.synthetic('complaint','context-'+i,{studentId:r.student_id,campusId:r.campus_id,courseId:r.course_id,category:'汇总上下文'},this.iso(r.first_at))));
  return{snapshot,organizationId};
 }
 private parameters(p:PreparedOperations){return{org:p.organizationId,dataset:p.snapshot.dataset.id,batches:clickHouseArray(p.snapshot.batches.filter(b=>b.status==='completed').map(b=>b.id))};}
 private row(r:Record<string,unknown>):StoredEducationRow{return{kind:r.kind as StoredEducationRow['kind'],sourceId:String(r.source_id),payload:JSON.parse(String(r.payload)),batchId:String(r.batch_id),hash:String(r.hash),studentId:String(r.student_id),campusId:String(r.campus_id),courseId:String(r.course_id),classId:String(r.class_id),occurredAt:r.occurred_at?this.iso(r.occurred_at):null,relativeDay:null};}
 private iso(value:unknown){const text=String(value);return new Date(text.includes('T')?text:text.replace(' ','T')+'Z').toISOString();}
 private synthetic(kind:StoredEducationRow['kind'],sourceId:string,payload:Record<string,unknown>,occurredAt:string|null):StoredEducationRow{return{kind,sourceId:'aggregate:'+sourceId,payload,batchId:'aggregate',hash:'aggregate',studentId:String(payload.studentId??''),campusId:String(payload.campusId??''),courseId:String(payload.courseId??''),classId:String(payload.classId??''),occurredAt,relativeDay:null};}
 async catalog(prepared:PreparedOperations,scope:AuthorizedScope){
  const p=this.scopeParameters(prepared,scope).parameters;
  const rows=await this.events.queryRows(`SELECT DISTINCT trimBoth(JSONExtractString(payload,'channelId')) id FROM education_events_v1 FINAL WHERE ${base} AND kind='lead' AND ${scoped} AND ${eventDate('acquiredAt')}<={cutoff:DateTime64(3,'UTC')}`,p);
  const ids=new Set(rows.map(r=>String(r.id)||unknownChannelId));ids.add(unknownChannelId);
  return[...ids].sort((a,b)=>a===unknownChannelId?1:b===unknownChannelId?-1:a.localeCompare(b)).map(id=>({id,name:channelName(id)}));
 }
 private scopeParameters(prepared:PreparedOperations,requested:AuthorizedScope){
  const snapshot=prepared.snapshot,cutoff=new Date(Math.min(milliseconds(snapshot.dataset.dataCutoff),requested.dataCutoff?milliseconds(requested.dataCutoff):Infinity,milliseconds(requested.endDate+'T23:59:59.999+08:00'))).toISOString(),scope={...requested,dataCutoff:cutoff};
  const observed=new Date(Math.min(milliseconds(snapshot.dataset.dataCutoff),milliseconds(requested.observationCutoff??requested.dataCutoff??snapshot.dataset.dataCutoff))).toISOString(),attribution=buildChannelAttribution(snapshot,cutoff);
  return{scope,observed,attribution,parameters:{...this.parameters(prepared),start:scope.startDate,end:scope.endDate,cutoff:date(cutoff),observed:date(observed),campuses:clickHouseArray(scope.campusIds),courses:clickHouseArray(scope.courseIds),authorized:clickHouseArray([...scope.authorizedCampusIds]),channels:clickHouseArray(scope.channelIds)}};
 }
 summarize(prepared:PreparedOperations,requested:AuthorizedScope):Promise<DatabaseOperationResult>{
  const key=JSON.stringify({...requested,campusIds:[...requested.campusIds].sort(),courseIds:[...requested.courseIds].sort(),channelIds:[...requested.channelIds].sort(),authorizedCampusIds:[...requested.authorizedCampusIds].sort()});
  const cache=prepared.summaries??=new Map<string,Promise<DatabaseOperationResult>>(),old=cache.get(key);if(old)return old;
  const pending=this.calculate(prepared,requested).catch(error=>{cache.delete(key);throw error;});cache.set(key,pending);return pending;
 }
 private async calculate(prepared:PreparedOperations,requested:AuthorizedScope):Promise<DatabaseOperationResult>{
  const {scope,observed,attribution,parameters:p}=this.scopeParameters(prepared,requested),baseSnapshot=prepared.snapshot;
  const snapshot:EducationSnapshot={...baseSnapshot,records:[...baseSnapshot.records]},allContracts=snapshot.records.filter(r=>r.kind==='contract'&&validOperationalContract(r));
  const contracts=allContracts.filter(r=>selected(scope,r)&&attribution.matches(String(r.payload.studentId),r.campusId,r.courseId,scope.channelIds)&&milliseconds(r.payload.signedAt)<=milliseconds(scope.dataCutoff)&&String(r.payload.endDate)>=scope.startDate);
  const classes=snapshot.records.filter(r=>r.kind==='class'&&selected(scope,r)),classMap=new Map(classes.map(r=>[r.sourceId,r]));
  const memberships=snapshot.records.filter(r=>r.kind==='enrollment'&&classMap.has(String(r.payload.classId))&&attribution.matches(String(r.payload.studentId),classMap.get(String(r.payload.classId))!.campusId,classMap.get(String(r.payload.classId))!.courseId,scope.channelIds));
  const enrollmentJSON=memberships.map(r=>({studentId:r.payload.studentId,classId:r.payload.classId,start:String(r.payload.startDate),end:String(r.payload.endDate??'')}));
  const classJSON=classes.map(r=>({id:r.sourceId,campusId:r.campusId,courseId:r.courseId}));
  const validContracts=allContracts.map(r=>({id:r.sourceId,leadId:String(r.payload.leadId??''),studentId:r.payload.studentId,campusId:r.campusId,courseId:r.courseId,signedAt:String(r.payload.signedAt),endDate:String(r.payload.endDate)}));
  const results=await Promise.all([
   this.attendance(prepared,scope,p,classJSON,enrollmentJSON),
   this.events.queryRows(`SELECT JSONExtractString(payload,'contractId') contract_id,sumIf(if(JSONExtractString(payload,'status')='reversed',-1,1)*JSONExtractFloat(payload,'hours'),kind='hours') consumed,sumIf(JSONExtractFloat(payload,'refundedHours'),kind='refund' AND JSONExtractString(payload,'status')='completed') refunded FROM education_events_v1 FINAL WHERE ${base} AND kind IN ('hours','refund') AND occurred_at<={cutoff:DateTime64(3,'UTC')} AND JSONExtractString(payload,'contractId') IN {contractIds:Array(String)} GROUP BY contract_id`,{...p,contractIds:clickHouseArray(allContracts.map(r=>r.sourceId))}),
   this.admission(p,validContracts),
   this.renewals(p,validContracts),
   this.complaints(p,attribution.contexts.map(c=>({studentId:c.studentId,campusId:c.campusId,courseId:c.courseId,channelId:c.channelId}))),
   this.events.queryRows(`SELECT count() refunds,sum(JSONExtractFloat(payload,'amount')) amount FROM education_events_v1 FINAL WHERE ${base} AND kind='refund' AND JSONExtractString(payload,'status')='completed' AND ${dayRange} AND JSONExtractString(payload,'contractId') IN {contractIds:Array(String)}`,{...p,contractIds:clickHouseArray(allContracts.filter(r=>selected(scope,r)&&attribution.matches(String(r.payload.studentId),r.campusId,r.courseId,scope.channelIds)&&milliseconds(r.payload.signedAt)<=milliseconds(scope.dataCutoff)).map(r=>r.sourceId))}),
  ]);
  const [attendance,ledger,admission,renewed,complaints,refunds]=results;
  const ledgerMap=new Map(ledger.map(r=>[String(r.contract_id),r]));let purchased=0,consumed=0,refunded=0;
  for(const c of contracts){const v=ledgerMap.get(c.sourceId);purchased+=Number(c.payload.purchasedHours);consumed+=numeric(v?.consumed);refunded+=numeric(v?.refunded);}
  // 余额画像可复用净账本；这些汇总记录只供本次截止，不写入业务库。
  for(const c of allContracts){const v=ledgerMap.get(c.sourceId);if(!v)continue;const payload={contractId:c.sourceId,studentId:c.payload.studentId,campusId:c.campusId,courseId:c.courseId};snapshot.records.push(this.synthetic('hours',c.sourceId,{...payload,hours:numeric(v.consumed),status:'completed'},scope.dataCutoff!));snapshot.records.push(this.synthetic('refund',c.sourceId,{...payload,refundedHours:numeric(v.refunded),amount:0,status:'completed'},scope.dataCutoff!));}
  const expired=contracts.filter(c=>String(c.payload.endDate)<=scope.endDate),eligibleStudents=new Set<string>(),renewedStudents=new Set<string>();let eligible=0,pendingRenewals=0,missingEligibility=0;
  const renewedIds=new Set(renewed.map(r=>String(r.contract_id)));
  for(const c of expired){if(c.payload.renewalEligible!=='yes'&&c.payload.renewalEligible!=='no'){missingEligibility++;continue;}if(c.payload.renewalEligible==='no')continue;eligible++;eligibleStudents.add(String(c.payload.studentId));if(milliseconds(String(c.payload.endDate)+'T23:59:59.999+08:00')+30*86400000>milliseconds(observed))pendingRenewals++;if(renewedIds.has(c.sourceId))renewedStudents.add(String(c.payload.studentId));}
  const a=admission[0]??{},funnel:ChannelFunnel={leads:numeric(a.leads),trialAttended:numeric(a.trials),converted:numeric(a.converted),afterTrial:numeric(a.after_trial),direct:numeric(a.converted)-numeric(a.after_trial),pending:numeric(a.pending),missingLinks:numeric(a.missing_links),windowDays:30,complete:numeric(a.pending)===0&&numeric(a.missing_links)===0};
  const available=purchased-refunded,invalid=consumed<0||available<0||consumed>available,c=complaints[0]??{},f=refunds[0]??{};
  const metrics:OperationalAggregateInput['metrics']={
   hours_progress:{numerator:consumed,denominator:available,unknown:invalid?1:0,reason:invalid?'净课耗与净购课时不一致，请核对流水':'与统计期相交的合约：累计净课耗／扣除退款后的净购课时',details:{purchased,refunded}},
   admission_conversion:{numerator:funnel.converted,denominator:funnel.leads,unknown:funnel.pending+funnel.missingLinks,reason:funnel.pending?'线索批次的观察窗口尚未满30天，完整转化率暂不显示':funnel.missingLinks?'旧版转换线索缺少合约关联，请使用第二版数据':'获取期线索在30天内明确关联签约；按线索去重',details:{pending:funnel.pending,missingLinks:funnel.missingLinks,windowDays:30}},
   renewal_rate:{numerator:renewedStudents.size,denominator:eligibleStudents.size,unknown:pendingRenewals+missingEligibility,reason:pendingRenewals?'到期批次的续费观察窗口尚未结束':missingEligibility?'部分到期合约缺少续费资格，无法确定完整分母':'具备续费资格的到期学员去重，窗口为到期前后30天；正常结课无需续费的合约排除',details:{pending:pendingRenewals,missingEligibility,eligibleContracts:eligible,excluded:expired.length-eligible-missingEligibility,windowDays:30}},
   complaint_count:{numerator:numeric(c.total),denominator:null,unknown:0,reason:'本期去重有效客诉数量',details:{open:numeric(c.open),resolved:numeric(c.resolved)}},
   refund_amount:{numerator:Math.round(numeric(f.amount)*100)/100,denominator:null,unknown:0,reason:'仅汇总实际完成退款，部分退款按实际金额，撤销记录排除',details:{refunds:numeric(f.refunds)}},
  };
  if(!completeKinds(snapshot,['trial']))funnel.complete=false;
  return{snapshot,aggregate:{attendance,metrics},funnel};
 }
 private async attendance(prepared:PreparedOperations,scope:AuthorizedScope,p:Record<string,string>,classes:unknown[],memberships:unknown[]):Promise<AttendanceFactsVO>{
  const rows=await this.events.queryRows(`WITH
   classes AS (SELECT JSONExtractString(j,'id') class_id,JSONExtractString(j,'campusId') campus_id,JSONExtractString(j,'courseId') course_id FROM (SELECT arrayJoin({classes:Array(String)}) j)),
   members AS (SELECT JSONExtractString(j,'studentId') student_id,JSONExtractString(j,'classId') class_id,JSONExtractString(j,'start') start_day,JSONExtractString(j,'end') end_day FROM (SELECT arrayJoin({members:Array(String)}) j)),
   lessons AS (SELECT source_id lesson_id,JSONExtractString(payload,'classId') class_id,${eventDate('startsAt')} starts_at FROM education_events_v1 FINAL WHERE ${base} AND kind='lesson' AND JSONExtractString(payload,'status')='completed'),
   due AS (SELECT l.lesson_id,m.student_id,c.campus_id,c.course_id,formatDateTime(l.starts_at,'%Y-%m','Asia/Shanghai') period FROM lessons l INNER JOIN classes c ON c.class_id=l.class_id INNER JOIN members m ON m.class_id=l.class_id WHERE l.starts_at<={cutoff:DateTime64(3,'UTC')} AND toDate(l.starts_at,'Asia/Shanghai') BETWEEN toDate({start:String}) AND toDate({end:String}) AND m.start_day<=toString(toDate(l.starts_at,'Asia/Shanghai')) AND (m.end_day='' OR m.end_day>toString(toDate(l.starts_at,'Asia/Shanghai'))) GROUP BY l.lesson_id,m.student_id,c.campus_id,c.course_id,period),
   signs AS (SELECT JSONExtractString(payload,'lessonId') lesson_id,JSONExtractString(payload,'studentId') student_id,groupUniqArray(JSONExtractString(payload,'status')) statuses FROM education_events_v1 FINAL WHERE ${base} AND kind='attendance' AND ${eventDate('recordedAt')}<={cutoff:DateTime64(3,'UTC')} GROUP BY lesson_id,student_id)
   SELECT d.student_id,d.campus_id,d.course_id,d.period,count() due,countIf(length(s.statuses)=1 AND s.statuses[1]='present') present,countIf(length(s.statuses)=1 AND s.statuses[1]='absent') absent,countIf(length(s.statuses)=1 AND s.statuses[1]='leave') leave FROM due d LEFT JOIN signs s ON d.lesson_id=s.lesson_id AND d.student_id=s.student_id GROUP BY d.student_id,d.campus_id,d.course_id,d.period
   UNION ALL SELECT '' student_id,c.campus_id,c.course_id,formatDateTime(l.starts_at,'%Y-%m','Asia/Shanghai') period,toUInt64(0) due,toUInt64(0) present,toUInt64(0) absent,toUInt64(0) leave FROM lessons l INNER JOIN classes c ON c.class_id=l.class_id WHERE l.starts_at<={cutoff:DateTime64(3,'UTC')} AND toDate(l.starts_at,'Asia/Shanghai') BETWEEN toDate({start:String}) AND toDate({end:String}) GROUP BY c.campus_id,c.course_id,period`,{...p,classes:jsonRows(classes),members:jsonRows(memberships)});
  const records=prepared.snapshot.records,people=new Map(records.filter(r=>r.kind==='student').map(r=>[r.sourceId,r.payload])),names=new Map(records.filter(r=>r.kind==='campus'||r.kind==='course').map(r=>[r.sourceId,String(r.payload.name)]));
  const total=empty(),students=new Map<string,StudentAttendanceVO>(),contexts=new Map<string,StudentAttendanceVO&{campusId:string;courseId:string}>(),periods=new Map<string,AttendanceCounts>(),groups=new Map<string,AttendanceCounts&{campusId:string;courseId:string;name:string}>();
  for(const row of rows){const id=String(row.student_id),campusId=String(row.campus_id),courseId=String(row.course_id),period=String(row.period),p=people.get(id),counts={due:numeric(row.due),present:numeric(row.present),absent:numeric(row.absent),leave:numeric(row.leave),unknown:numeric(row.due)-numeric(row.present)-numeric(row.absent)-numeric(row.leave)};
   const person=()=>({...empty(),studentId:id,displayName:String(p?.displayName??id),gradeBand:String(p?.gradeBand??'未填写'),attendanceRate:null,campusIds:[] as string[],courseIds:[] as string[]});
   const student=students.get(id)??person(),key=JSON.stringify([id,campusId,courseId]),context=contexts.get(key)??{...person(),campusId,courseId,campusIds:[campusId],courseIds:[courseId]},month=periods.get(period)??empty(),groupKey=JSON.stringify([campusId,courseId]),group=groups.get(groupKey)??{...empty(),campusId,courseId,name:(names.get(campusId)??campusId)+' / '+(names.get(courseId)??courseId)};
   if(!id){periods.set(period,month);groups.set(groupKey,group);continue;}
   for(const target of [total,student,context,month,group])for(const name of ['due','present','absent','leave','unknown'] as const)target[name]+=counts[name];
   if(!student.campusIds.includes(campusId))student.campusIds.push(campusId);if(!student.courseIds.includes(courseId))student.courseIds.push(courseId);
   students.set(id,student);contexts.set(key,context);periods.set(period,month);groups.set(groupKey,group);
  }
  for(const s of [...students.values(),...contexts.values()]){s.attendanceRate=s.unknown||!s.due?null:Math.round(s.present/s.due*10000)/100;s.campusIds.sort();s.courseIds.sort();}
  return{scope,total,students:[...students.values()].sort((a,b)=>a.studentId.localeCompare(b.studentId)),studentGroups:[...contexts.values()],periods:[...periods].sort(([a],[b])=>a.localeCompare(b)).map(([period,counts])=>({period,counts})),groups:[...groups.values()]};
 }
 private async admission(p:Record<string,string>,contracts:unknown[]){
  return this.events.queryRows(`WITH
   contracts AS (SELECT JSONExtractString(j,'leadId') lead_id,JSONExtractString(j,'campusId') campus_id,JSONExtractString(j,'courseId') course_id,parseDateTime64BestEffortOrNull(JSONExtractString(j,'signedAt'),3,'UTC') signed_at FROM (SELECT arrayJoin({contracts:Array(String)}) j) WHERE lead_id!=''),
   leads AS (SELECT source_id lead_id,campus_id,course_id,${eventDate('acquiredAt')} acquired_at,JSONExtractString(payload,'status') status FROM education_events_v1 FINAL WHERE ${base} AND kind='lead' AND ${scoped} AND ${dayRange} AND (empty({channels:Array(String)}) OR if(trimBoth(JSONExtractString(payload,'channelId'))='','__unknown__',trimBoth(JSONExtractString(payload,'channelId'))) IN {channels:Array(String)})),
   trials AS (SELECT JSONExtractString(payload,'leadId') lead_id,campus_id,course_id,occurred_at FROM education_events_v1 FINAL WHERE ${base} AND kind='trial' AND JSONExtractString(payload,'status')='attended'),
   trial_summary AS (SELECT l.lead_id,countIf(t.occurred_at>=l.acquired_at AND t.occurred_at<=least(l.acquired_at+INTERVAL 30 DAY,{observed:DateTime64(3,'UTC')}) AND t.campus_id=l.campus_id AND t.course_id=l.course_id) trial_count,minIf(t.occurred_at,t.occurred_at>=l.acquired_at AND t.occurred_at<=least(l.acquired_at+INTERVAL 30 DAY,{observed:DateTime64(3,'UTC')}) AND t.campus_id=l.campus_id AND t.course_id=l.course_id) first_trial FROM leads l LEFT JOIN trials t ON l.lead_id=t.lead_id GROUP BY l.lead_id),
   summary AS (SELECT l.lead_id,l.status,l.acquired_at,t.trial_count,t.first_trial,countIf(c.lead_id!='') linked_count,countIf(c.campus_id=l.campus_id AND c.course_id=l.course_id AND c.signed_at>=l.acquired_at AND c.signed_at<=least(l.acquired_at+INTERVAL 30 DAY,{observed:DateTime64(3,'UTC')})) converted_count,countIf(t.trial_count>0 AND c.campus_id=l.campus_id AND c.course_id=l.course_id AND c.signed_at>=l.acquired_at AND c.signed_at<=least(l.acquired_at+INTERVAL 30 DAY,{observed:DateTime64(3,'UTC')}) AND t.first_trial<=c.signed_at) after_count FROM leads l LEFT JOIN contracts c ON l.lead_id=c.lead_id LEFT JOIN trial_summary t ON l.lead_id=t.lead_id GROUP BY l.lead_id,l.status,l.acquired_at,t.trial_count,t.first_trial)
   SELECT count() leads,countIf(trial_count>0) trials,countIf(converted_count>0) converted,countIf(after_count>0) after_trial,countIf(acquired_at+INTERVAL 30 DAY>{observed:DateTime64(3,'UTC')}) pending,countIf(converted_count=0 AND status='converted' AND linked_count=0) missing_links FROM summary`,{...p,contracts:jsonRows(contracts)});
 }
 private async renewals(p:Record<string,string>,contracts:unknown[]){
  return this.events.queryRows(`WITH contracts AS (SELECT JSONExtractString(j,'id') id,JSONExtractString(j,'studentId') student_id,JSONExtractString(j,'campusId') campus_id,JSONExtractString(j,'courseId') course_id,parseDateTime64BestEffortOrNull(JSONExtractString(j,'signedAt'),3,'UTC') signed_at,toDateTime64(concat(JSONExtractString(j,'endDate'),' 23:59:59.999'),3,'Asia/Shanghai') expiry FROM (SELECT arrayJoin({contracts:Array(String)}) j)), renewals AS (SELECT JSONExtractString(payload,'contractId') old_id,JSONExtractString(payload,'newContractId') new_id,JSONExtractString(payload,'studentId') student_id,occurred_at FROM education_events_v1 FINAL WHERE ${base} AND kind='renewal') SELECT DISTINCT o.id contract_id FROM renewals r INNER JOIN contracts o ON r.old_id=o.id INNER JOIN contracts n ON r.new_id=n.id WHERE r.student_id=o.student_id AND n.student_id=o.student_id AND n.campus_id=o.campus_id AND n.course_id=o.course_id AND r.occurred_at>=o.expiry-INTERVAL 30 DAY AND r.occurred_at<=least(o.expiry+INTERVAL 30 DAY,{observed:DateTime64(3,'UTC')}) AND n.signed_at<=r.occurred_at`,{...p,contracts:jsonRows(contracts)});
 }
 private async complaints(p:Record<string,string>,attributions:unknown[]){
  // 未有合约/在班记录的客诉上下文也能正确归入未知，不能仅依赖成员名单过滤。
  return this.events.queryRows(`WITH attribution AS (SELECT JSONExtractString(j,'studentId') student_id,JSONExtractString(j,'campusId') campus_id,JSONExtractString(j,'courseId') course_id,JSONExtractString(j,'channelId') channel_id FROM (SELECT arrayJoin({attributions:Array(String)}) j)), complaints AS (SELECT student_id,campus_id,course_id,JSONExtractString(payload,'status') status FROM education_events_v1 FINAL WHERE ${base} AND kind='complaint' AND ${scoped} AND ${dayRange}) SELECT count() total,countIf(c.status='open') open,countIf(c.status='resolved') resolved FROM complaints c LEFT JOIN attribution a ON c.student_id=a.student_id AND c.campus_id=a.campus_id AND c.course_id=a.course_id WHERE empty({channels:Array(String)}) OR if(a.channel_id='','__unknown__',a.channel_id) IN {channels:Array(String)}`,{...p,attributions:jsonRows(attributions)});
 }
}

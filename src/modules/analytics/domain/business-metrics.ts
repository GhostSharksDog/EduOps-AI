import type {EducationSnapshot,StoredEducationRow} from '@/modules/education/contracts';
import {buildChannelAttribution,effectiveChannelId,validOperationalContract,type ChannelAttributionIndex} from '@/modules/education/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import type {OperationalMetric} from '../contracts';
type MetricFactory=(code:string,n:number|null,d:number|null,unknown?:number,reason?:string,details?:Record<string,number>,status?:OperationalMetric['status'])=>OperationalMetric;
const day=(v:unknown)=>new Date(new Date(String(v)).getTime()+8*3600000).toISOString().slice(0,10);
const endOfDay=(v:unknown)=>Date.parse(String(v)+'T23:59:59.999+08:00');
export function businessMetrics(snapshot:EducationSnapshot,scope:AuthorizedScope,observationCutoff:string,metric:MetricFactory,has:(k:string[])=>boolean,attribution?:ChannelAttributionIndex):Record<string,OperationalMetric>{
 const rows=(k:string)=>snapshot.records.filter(r=>r.kind===k), cutoff=Date.parse(scope.dataCutoff!),observed=Date.parse(observationCutoff);
 const selected=(r:StoredEducationRow)=>(!scope.campusIds.length||scope.campusIds.includes(r.campusId))&&(!scope.courseIds.length||scope.courseIds.includes(r.courseId))&&(!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.campusId));
 const channels=attribution??buildChannelAttribution(snapshot,scope.dataCutoff!),selectedBusiness=(r:StoredEducationRow)=>selected(r)&&channels.matches(String(r.payload.studentId),r.campusId,r.courseId,scope.channelIds);
 const within=(r:StoredEducationRow)=>!!r.occurredAt&&day(r.occurredAt)>=scope.startDate&&day(r.occurredAt)<=scope.endDate&&Date.parse(r.occurredAt)<=cutoff;
 const contracts=rows('contract').filter(validOperationalContract), contractMap=new Map(contracts.map(r=>[r.sourceId,r]));
 const leads=rows('lead').filter(r=>selected(r)&&within(r)&&(!scope.channelIds.length||scope.channelIds.includes(effectiveChannelId(r.payload.channelId))));let converted=0,pendingLeads=0,missingLeadLinks=0;
 const linked=new Map<string,StoredEducationRow[]>();
 for(const c of contracts)if(c.payload.leadId)linked.set(String(c.payload.leadId),[...(linked.get(String(c.payload.leadId))??[]),c]);
 for(const lead of leads){const start=Date.parse(String(lead.payload.acquiredAt)),deadline=start+30*86400000;if(deadline>observed)pendingLeads++;
  const valid=(linked.get(lead.sourceId)??[]).some(c=>c.campusId===lead.campusId&&c.courseId===lead.courseId&&Date.parse(String(c.payload.signedAt))>=start&&Date.parse(String(c.payload.signedAt))<=Math.min(deadline,observed));
  if(valid)converted++;else if(!linked.has(lead.sourceId)&&lead.payload.status==='converted')missingLeadLinks++;
 }
 const expired=contracts.filter(c=>selectedBusiness(c)&&Date.parse(String(c.payload.signedAt))<=cutoff&&String(c.payload.endDate)>=scope.startDate&&String(c.payload.endDate)<=scope.endDate);
 const eligibleStudents=new Set<string>(),renewedStudents=new Set<string>();let eligible=0,pendingRenewals=0,missingEligibility=0;
 const renewals=rows('renewal');
 for(const c of expired){if(c.payload.renewalEligible!=='yes'&&c.payload.renewalEligible!=='no'){missingEligibility++;continue;}if(c.payload.renewalEligible==='no')continue;
  eligible++;eligibleStudents.add(String(c.payload.studentId));const expiry=endOfDay(c.payload.endDate),deadline=expiry+30*86400000;if(deadline>observed)pendingRenewals++;
  const valid=renewals.some(r=>{const next=contractMap.get(String(r.payload.newContractId));return r.payload.contractId===c.sourceId&&r.payload.studentId===c.payload.studentId&&r.occurredAt&&Date.parse(r.occurredAt)>=expiry-30*86400000&&Date.parse(r.occurredAt)<=Math.min(deadline,observed)&&!!next&&next.payload.studentId===c.payload.studentId&&next.campusId===c.campusId&&next.courseId===c.courseId&&Date.parse(String(next.payload.signedAt))<=Date.parse(r.occurredAt);});
  if(valid)renewedStudents.add(String(c.payload.studentId));
 }
 const classes=new Map(rows('class').filter(selected).map(r=>[r.sourceId,r]));
 const memberships=rows('enrollment').filter(r=>{const cls=classes.get(String(r.payload.classId));return !!cls&&channels.matches(String(r.payload.studentId),cls.campusId,cls.courseId,scope.channelIds);});
 const at=(date:string)=>new Set(memberships.filter(r=>String(r.payload.startDate)<=date&&(!r.payload.endDate||String(r.payload.endDate)>date)).map(r=>String(r.payload.studentId)));
 const start=at(scope.startDate),finish=at(day(scope.dataCutoff));let retained=0,completed=0,withdrawn=0,other=0;
 for(const student of start){if(finish.has(student)){retained++;continue;}const ending=memberships.filter(r=>r.payload.studentId===student&&r.payload.endDate&&String(r.payload.endDate)>=scope.startDate&&String(r.payload.endDate)<=day(scope.dataCutoff)).sort((a,b)=>String(b.payload.endDate).localeCompare(String(a.payload.endDate)))[0];
  if(ending?.payload.endReason==='completed')completed++;else if(ending?.payload.endReason==='withdrawn')withdrawn++;else other++;
 }
 const complaints=rows('complaint').filter(r=>selectedBusiness(r)&&within(r)),refunds=rows('refund').filter(r=>{const c=contractMap.get(String(r.payload.contractId));return !!c&&selectedBusiness(c)&&Date.parse(String(c.payload.signedAt))<=cutoff&&r.payload.status==='completed'&&within(r);});
 const missing=(code:string,reason:string)=>metric(code,null,null,0,reason);
 const results:Record<string,OperationalMetric>={
  admission_conversion:has(['lead','contract'])?metric('admission_conversion',converted,leads.length,pendingLeads+missingLeadLinks,pendingLeads?'线索批次的观察窗口尚未满30天，完整转化率暂不显示':missingLeadLinks?'旧版转换线索缺少合约关联，请使用第二版数据':'获取期线索在30天内明确关联签约；按线索去重',{pending:pendingLeads,missingLinks:missingLeadLinks,windowDays:30}):missing('admission_conversion','尚未完成线索和合约导入'),
  renewal_rate:has(['contract','renewal'])?metric('renewal_rate',renewedStudents.size,eligibleStudents.size,pendingRenewals+missingEligibility,pendingRenewals?'到期批次的续费观察窗口尚未结束':missingEligibility?'部分到期合约缺少续费资格，无法确定完整分母':'具备续费资格的到期学员去重，窗口为到期前后30天；正常结课无需续费的合约排除',{pending:pendingRenewals,missingEligibility,eligibleContracts:eligible,excluded:expired.length-eligible-missingEligibility,windowDays:30}):missing('renewal_rate','尚未完成合约及续费记录导入'),
  retention_rate:has(['class','enrollment'])?metric('retention_rate',retained,start.size,cutoff<Date.parse(scope.startDate+'T00:00:00+08:00')||day(scope.dataCutoff)<scope.endDate?1:0,'期初与期末在读学员交集；离开在读状态不直接等同流失',{completed,withdrawn,otherOrUnknown:other}):missing('retention_rate','尚未完成班级及在班导入'),
  complaint_count:has(['complaint'])?metric('complaint_count',complaints.length,null,0,'本期去重有效客诉数量',{open:complaints.filter(r=>r.payload.status==='open').length,resolved:complaints.filter(r=>r.payload.status==='resolved').length}):missing('complaint_count','尚未完成客诉导入'),
  refund_amount:has(['contract','refund'])?metric('refund_amount',Math.round(refunds.reduce((n,r)=>n+Number(r.payload.amount),0)*100)/100,null,0,'仅汇总实际完成退款，部分退款按实际金额，撤销记录排除',{refunds:refunds.length}):missing('refund_amount','尚未完成合约及退款导入'),
 };
 for(const m of Object.values(results))m.observationCutoff=observationCutoff;
 return results;
}

import type {RiskSegmentSnapshotVO,RiskSnapshotAggregate} from '@/modules/segment/contracts';
import type {RiskCrowdProfileVO,RiskStudentProfileVO} from '../contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
export function riskStudentProfile(snapshot:RiskSegmentSnapshotVO,id:string):RiskStudentProfileVO {
    const s=snapshot.preview.members.find(m=>m.studentId===id);if(!s)throw new WorkflowError('学员不属于此人群快照',404);
    return {...s,snapshotId:snapshot.id,tagId:snapshot.sourceTagId,tagVersion:snapshot.tagVersion,datasetName:snapshot.preview.dataset.name,origin:snapshot.preview.dataset.origin,evidence:snapshot.preview.evidence};
}
/** Compose presentation from bounded SQL aggregates; page members never determine crowd totals. */
export function riskCrowdFromAggregate(snapshot:RiskSegmentSnapshotVO,a:RiskSnapshotAggregate):RiskCrowdProfileVO {
    const totals=a.attendance,observed=totals.observedStudents;
    const business=a.hasBusiness?{asOf:a.asOf,knownBalanceStudents:a.knownBalanceStudents,unknownBalanceStudents:a.unknownBalanceStudents,remainingHours:a.remainingHours,renewalFollowupStudents:a.renewalFollowupStudents,recentComplaintStudents:a.recentComplaintStudents}:undefined;
    const titles:Record<string,string>={campus:'校区分布（学员可属于多个校区）',course:'课程分布（学员可属于多门课程）',grade:'年级分布',hours:'同范围课时余额分布（课时）',expiry:'未来30天续费跟进（截至快照日）',complaint:'最近30天客诉学员分布'};
    const keys=['campus','course','grade',...(a.hasBusiness?['hours','expiry','complaint']:[])];
    return {snapshot,business,attendance:{...totals,rate:!totals.due||totals.unknown?null:Math.round(totals.present/totals.due*10000)/100},
        distributions:keys.map(key=>({key,title:titles[key],values:(a.distributions.find(d=>d.key===key)?.values??[]).sort((x,y)=>x.label.localeCompare(y.label))})),
        facts:['此快照包含 '+snapshot.memberCount+' 名去重学员。',...(observed?['已确认缺勤 '+totals.absent+' 人次，请假 '+totals.leave+' 人次，未知签到 '+totals.unknown+' 人次。']:['快照未计算出勤，不补造出勤数字。']),...(business?['截至 '+a.asOf+'，未来30天续费待跟进 '+(business.renewalFollowupStudents??'待核查')+' 人，最近30天发生客诉 '+(business.recentComplaintStudents??'待核查')+' 人。']:[])],
        hypotheses:snapshot.memberCount?['匹配条件反映已知记录，具体原因和服务需求仍须结合沟通记录核查。']:[],
        actions:snapshot.memberCount?[...(observed?['由课程主管核对缺勤与未知签到记录，记录核查结果。']:[]),...(a.upcomingCount?['由学员服务人员核实续费资格和截止日后的最新进展，再安排沟通。']:[]),...(business?.knownBalanceStudents?['核对合约余额、退款和课程计划，安排课包提醒；零余额单列处理。']:[]),...(a.complainedCount?['按实际客诉记录确认诉求和最新处理状态，不从历史快照推断当前未解决。']:[]),'核实后记录服务安排，在下一统计周期复核；此处为固定流程建议。']:['当前规则没有匹配学员，可调整统计范围或规则后建立新版本。'],evidence:snapshot.preview.evidence};
}
export function riskCrowdProfile(snapshot:RiskSegmentSnapshotVO):RiskCrowdProfileVO {
    const p=snapshot.preview,members=p.members,observed=members.filter(m=>typeof m.due==='number'),totals=observed.reduce((n,m)=>({present:n.present+(m.present??0),due:n.due+(m.due??0),absent:n.absent+(m.absent??0),leave:n.leave+(m.leave??0),unknown:n.unknown+(m.unknown??0)}),{present:0,due:0,absent:0,leave:0,unknown:0});
    const count=(values:string[])=>{const map=new Map<string,number>();for(const value of values)map.set(value,(map.get(value)??0)+1);return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([label,count])=>({label,count}));};
    const label=(id:string)=>p.catalog.find(c=>c.id===id)?.name??id;
    const contexts=members.flatMap(m=>m.business??[]),asOf=contexts[0]?.asOf??p.scope.endDate;
    const balances=members.map(m=>{const cs=m.business??[],known=cs.filter(c=>c.hours.status==='ready');return {id:m.studentId,known:known.length>0&&!cs.some(c=>c.hours.status==='unknown'),value:known.reduce((n,c)=>n+(c.hours.remaining??0),0),unknown:cs.some(c=>c.hours.status==='unknown')};});
    const upcoming=new Set(contexts.filter(c=>c.contracts.some(v=>v.renewalEligible==='yes'&&!v.renewed&&v.endDate>=asOf&&Date.parse(v.endDate+'T00:00:00+08:00')-Date.parse(asOf+'T00:00:00+08:00')<=30*86400000)).map(c=>c.studentId));
    const complained=new Set(contexts.filter(c=>c.complaints.some(v=>Date.parse(v.occurredAt)>=Date.parse(asOf+'T00:00:00+08:00')-29*86400000)).map(c=>c.studentId));
    const renewalUnknown=(m:typeof members[number])=>!(m.business?.length)||m.business.some(c=>!c.renewalComplete||c.contracts.some(v=>v.renewalEligible===null));
    const complaintUnknown=(m:typeof members[number])=>!(m.business?.length)||m.business.some(c=>!c.complaintsComplete);
    const extra=contexts.length?[{key:'hours',title:'同范围课时余额分布（课时）',values:count(balances.map(b=>b.unknown?'余额待核查':!b.known?'无有效在班合约':b.value===0?'零余额':b.value<=8?'大于0至8':b.value<=24?'大于8至24':'大于24'))},{key:'expiry',title:'未来30天续费跟进（截至快照日）',values:count(members.map(m=>upcoming.has(m.studentId)?'到期待跟进':renewalUnknown(m)?'资格或数据待核查':'其他或无需续费'))},{key:'complaint',title:'最近30天客诉学员分布',values:count(members.map(m=>complained.has(m.studentId)?'近期发生客诉':complaintUnknown(m)?'客诉数据待核查':'无近期客诉'))}]:[];
    const business=contexts.length?{asOf,knownBalanceStudents:balances.filter(b=>b.known).length,remainingHours:balances.some(b=>b.unknown)?null:balances.some(b=>b.known)?Math.round(balances.filter(b=>b.known).reduce((n,b)=>n+b.value,0)*100)/100:null,renewalFollowupStudents:members.every(m=>!renewalUnknown(m))?upcoming.size:null,recentComplaintStudents:members.every(m=>!complaintUnknown(m))?complained.size:null,unknownBalanceStudents:balances.filter(b=>b.unknown).length}:undefined;
    return {snapshot,business,attendance:{...totals,observedStudents:observed.length,rate:!totals.due||totals.unknown?null:Math.round(totals.present/totals.due*10000)/100},
        distributions:[{key:'campus',title:'校区分布（学员可属于多个校区）',values:count(members.flatMap(m=>m.campusIds.map(label)))},{key:'course',title:'课程分布（学员可属于多门课程）',values:count(members.flatMap(m=>m.courseIds.map(label)))},{key:'grade',title:'年级分布',values:count(members.map(m=>m.gradeBand))},...extra],
        facts:['此快照包含 '+snapshot.memberCount+' 名去重学员。',...(observed.length?['已确认缺勤 '+totals.absent+' 人次，请假 '+totals.leave+' 人次，未知签到 '+totals.unknown+' 人次。']:['快照未计算出勤，不补造出勤数字。']),...(business?['截至 '+asOf+'，未来30天续费待跟进 '+(business.renewalFollowupStudents??'待核查')+' 人，最近30天发生客诉 '+(business.recentComplaintStudents??'待核查')+' 人。']:[])],
        hypotheses:members.length?['匹配条件反映已知记录，具体原因和服务需求仍须结合沟通记录核查。']:[],
        actions:members.length?[...(observed.length?['由课程主管核对缺勤与未知签到记录，记录核查结果。']:[]),...(upcoming.size?['由学员服务人员核实续费资格和截止日后的最新进展，再安排沟通。']:[]),...(business?.knownBalanceStudents?['核对合约余额、退款和课程计划，安排课包提醒；零余额单列处理。']:[]),...(complained.size?['按实际客诉记录确认诉求和最新处理状态，不从历史快照推断当前未解决。']:[]),'核实后记录服务安排，在下一统计周期复核；此处为固定流程建议。']:['当前规则没有匹配学员，可调整统计范围或规则后建立新版本。'],
        evidence:p.evidence};
}

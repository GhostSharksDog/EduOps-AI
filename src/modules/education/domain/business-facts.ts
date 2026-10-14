import type {EducationSnapshot,StoredEducationRow} from '../contracts/data';
import {buildAttendanceFacts,completeKinds,effectiveEducationScope,educationDay,enrollmentActive} from './attendance';
import type {StudentAttendanceVO,AttendanceFactsVO} from '../contracts/attendance';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import {buildChannelAttribution,validOperationalContract} from './channels';

export interface StudentBusinessContext {
    studentId:string;displayName:string;gradeBand:string;campusId:string;courseId:string;campusName:string;courseName:string;asOf:string;active:boolean;
    attendance:StudentAttendanceVO|null;attendanceComplete:boolean;channelId?:string;channelReason?:string;
    contracts:{id:string;endDate:string;renewalEligible:'yes'|'no'|null;renewed:boolean}[];renewalComplete:boolean;
    hours:{status:'ready'|'unknown'|'not_applicable';remaining:number|null;purchased:number|null;consumed:number|null;refunded:number|null;reason:string};
    complaints:{occurredAt:string;category:string}[];complaintsComplete:boolean;
}
export const businessFactKinds=['campus','course','student','class','enrollment','contract','lesson','attendance','hours','refund','renewal','complaint','lead'] as const;
export function buildStudentBusinessFacts(snapshot:EducationSnapshot,requested:AuthorizedScope,calculatedAttendance?:AttendanceFactsVO) {
    const scope=effectiveEducationScope(snapshot,requested),cutoff=Date.parse(scope.dataCutoff!),asOf=educationDay(scope.dataCutoff);
    const channels=buildChannelAttribution(snapshot,scope.dataCutoff!);
    const byKind=new Map<string,StoredEducationRow[]>();for(const r of snapshot.records){let list=byKind.get(r.kind);if(!list){list=[];byKind.set(r.kind,list);}list.push(r);}
    const rows=(k:string)=>byKind.get(k)??[],selected=(r:StoredEducationRow)=>(!scope.campusIds.length||scope.campusIds.includes(r.campusId))&&(!scope.courseIds.length||scope.courseIds.includes(r.courseId))&&(!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.campusId));
    const people=new Map(rows('student').map(r=>[r.sourceId,r])),catalog=new Map([...rows('campus'),...rows('course')].map(r=>[r.sourceId,String(r.payload.name)]));
    const classes=new Map(rows('class').filter(selected).map(r=>[r.sourceId,r]));
    const contexts=new Map<string,StudentBusinessContext>(),enrollmentComplete=completeKinds(snapshot,['class','enrollment']);
    const get=(studentId:string,campusId:string,courseId:string)=>{const key=JSON.stringify([studentId,campusId,courseId]);let c=contexts.get(key);if(!c){const p=people.get(studentId);c={studentId,displayName:String(p?.payload.displayName??studentId),gradeBand:String(p?.payload.gradeBand??'未填写'),campusId,courseId,campusName:catalog.get(campusId)??campusId,courseName:catalog.get(courseId)??courseId,asOf,active:false,attendance:null,attendanceComplete:completeKinds(snapshot,['class','enrollment','lesson','attendance']),contracts:[],renewalComplete:completeKinds(snapshot,['contract','renewal']),hours:{status:'not_applicable',remaining:null,purchased:null,consumed:null,refunded:null,reason:'截止日无有效在班合约'},complaints:[],complaintsComplete:completeKinds(snapshot,['complaint'])};contexts.set(key,c);}return c;};
    for(const e of rows('enrollment')){const cls=classes.get(String(e.payload.classId));if(!cls||!channels.matches(String(e.payload.studentId),cls.campusId,cls.courseId,scope.channelIds)||String(e.payload.startDate)>asOf||(e.payload.endDate&&String(e.payload.endDate)<scope.startDate))continue;const c=get(String(e.payload.studentId),cls.campusId,cls.courseId);c.active ||= enrollmentActive(e,asOf);}
    const contractMap=new Map(rows('contract').map(r=>[r.sourceId,r]));
    const renewals=new Map<string,StoredEducationRow[]>();for(const r of rows('renewal'))if(r.occurredAt&&Date.parse(r.occurredAt)<=cutoff)renewals.set(String(r.payload.contractId),[...(renewals.get(String(r.payload.contractId))??[]),r]);
    const ledger=new Map<string,{consumed:number;refunded:number}>();
    for(const r of [...rows('hours'),...rows('refund')]){if(!r.occurredAt||Date.parse(r.occurredAt)>cutoff)continue;const id=String(r.payload.contractId),v=ledger.get(id)??{consumed:0,refunded:0};if(r.kind==='hours')v.consumed+=Number(r.payload.hours)*(r.payload.status==='reversed'?-1:1);else if(r.payload.status==='completed')v.refunded+=Number(r.payload.refundedHours);ledger.set(id,v);}
    const current=new Map<StudentBusinessContext,StoredEducationRow[]>();
    for(const r of rows('contract')){if(!selected(r)||!validOperationalContract(r)||!channels.matches(String(r.payload.studentId),r.campusId,r.courseId,scope.channelIds)||Date.parse(String(r.payload.signedAt))>cutoff||String(r.payload.endDate)<scope.startDate)continue;const c=get(String(r.payload.studentId),r.campusId,r.courseId);if(String(r.payload.endDate)<asOf)continue;
        c.contracts.push({id:r.sourceId,endDate:String(r.payload.endDate),renewalEligible:r.payload.renewalEligible==='yes'?'yes':r.payload.renewalEligible==='no'?'no':null,renewed:(renewals.get(r.sourceId)??[]).some(v=>{const next=contractMap.get(String(v.payload.newContractId));return !!next&&v.payload.studentId===r.payload.studentId&&next.payload.studentId===r.payload.studentId&&next.campusId===r.campusId&&next.courseId===r.courseId&&Date.parse(String(next.payload.signedAt))<=cutoff;})});current.set(c,[...(current.get(c)??[]),r]);
    }
    for(const c of contexts.values()){if(!enrollmentComplete||!completeKinds(snapshot,['contract','hours','refund'])){c.hours={status:'unknown',remaining:null,purchased:null,consumed:null,refunded:null,reason:'在班、合约、课耗或退款导入不完整'};continue;}if(!c.active)continue;const contracts=current.get(c)??[];if(!contracts.length)continue;
        let purchased=0,consumed=0,refunded=0,invalid=false;for(const r of contracts){const h=ledger.get(r.sourceId)??{consumed:0,refunded:0};const p=Number(r.payload.purchasedHours);purchased+=p;consumed+=h.consumed;refunded+=h.refunded;if(h.consumed<0||h.refunded<0||p-h.consumed-h.refunded<0)invalid=true;}
        const round=(n:number)=>Math.round(n*100)/100;c.hours={status:invalid?'unknown':'ready',remaining:invalid?null:round(purchased-consumed-refunded),purchased:round(purchased),consumed:round(consumed),refunded:round(refunded),reason:invalid?'合约余额或撤销流水不一致，需核查':purchased===refunded?'已完成退款清空课时':purchased-consumed-refunded===0?'课时余额为零，单列核查':'截止日累计购课减净课耗及完成退款课时'};
    }
    for(const r of rows('complaint'))if(selected(r)&&channels.matches(String(r.payload.studentId),r.campusId,r.courseId,scope.channelIds)&&r.occurredAt&&Date.parse(r.occurredAt)<=cutoff){const c=get(String(r.payload.studentId),r.campusId,r.courseId);c.complaints.push({occurredAt:r.occurredAt,category:String(r.payload.category)});}
    const attendance=calculatedAttendance??buildAttendanceFacts(snapshot,scope);
    for(const s of attendance.studentGroups??[]){const c=get(s.studentId,s.campusId,s.courseId);c.attendance=s;}
    for(const c of contexts.values()){const attribution=channels.get(c.studentId,c.campusId,c.courseId);c.channelId=attribution.channelId;c.channelReason=attribution.reason;}
    return {scope,contexts:[...contexts.values()].sort((a,b)=>(a.studentId+a.campusId+a.courseId).localeCompare(b.studentId+b.campusId+b.courseId)),attendance};
}

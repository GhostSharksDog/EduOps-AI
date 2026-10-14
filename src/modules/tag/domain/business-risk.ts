import {buildStudentBusinessFacts} from '@/modules/education/contracts';
import type {EducationSnapshot,StudentBusinessContext} from '@/modules/education/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import type {OperationalTagRuleDTO,OperationalLeafRuleDTO,OperationalTagMember,RuleMatch} from '../contracts/risk';

export function ruleDescription(rule:OperationalTagRuleDTO):string {
    if(rule.type==='all'||rule.type==='any')return '('+rule.conditions.map(ruleDescription).join(rule.type==='all'?' 且 ':' 或 ')+')，同校区同课程';
    if(rule.type==='attendance_below')return '出勤率低于'+rule.thresholdPercent+'%，应出勤至少'+rule.minimumDue+'次';
    if(rule.type==='absence_count')return '已确认缺勤至少'+rule.minimumAbsences+'次，应出勤至少'+rule.minimumDue+'次';
    if(rule.type==='renewal_due')return '未来'+rule.withinDays+'天内到期且具备资格、截止日尚未续费';
    if(rule.type==='hours_remaining')return '截止日仍在班，有效合约剩余课时大于0且不超过'+rule.maximumHours+'课时';
    return '最近'+rule.lookbackDays+'天内发生至少'+rule.minimumCount+'条客诉';
}
export const isAttendanceRule=(r:OperationalTagRuleDTO):r is Extract<OperationalLeafRuleDTO,{type:'absence_count'|'attendance_below'}>=>r.type==='absence_count'||r.type==='attendance_below';
export function evaluateLeaf(c:StudentBusinessContext,rule:OperationalLeafRuleDTO):RuleMatch {
    let state:RuleMatch['state']='false',reason='未达到条件';
    const value=(v:boolean)=>v?'true':'false';
    if(rule.type==='absence_count'||rule.type==='attendance_below'){
        const a=c.attendance;
        if(!c.attendanceComplete){state='unknown';reason='签到相关数据尚未完整导入';}
        else if(!a||a.due<rule.minimumDue){reason='应出勤次数不足，不匹配';}
        else if(rule.type==='absence_count'){state=value(a.absent>=rule.minimumAbsences);reason='已确认缺勤 '+a.absent+' 次；未知签到 '+a.unknown+' 次另列';}
        else if(a.unknown){state='unknown';reason='存在未知签到，完整出勤率无法判断';}
        else {state=value(a.present/a.due*100<rule.thresholdPercent);reason='出勤 '+a.present+'/'+a.due+'，实际出勤率 '+a.attendanceRate+'%';}
    }else if(rule.type==='renewal_due'){
        const end=new Date(Date.parse(c.asOf+'T00:00:00+08:00')+rule.withinDays*86400000);const deadline=new Date(end.getTime()+8*3600000).toISOString().slice(0,10);
        const relevant=c.contracts.filter(v=>v.endDate>=c.asOf&&v.endDate<=deadline);
        if(!c.renewalComplete){state='unknown';reason='合约及续费数据尚未完整导入';}
        else if(relevant.some(v=>v.renewalEligible==='yes'&&!v.renewed)){state='true';reason='符合续费资格且尚未续费的到期合约：'+relevant.filter(v=>v.renewalEligible==='yes'&&!v.renewed).map(v=>v.endDate).join('、');}
        else if(relevant.some(v=>v.renewalEligible===null)){state='unknown';reason='到期合约缺少续费资格';}
        else reason='无符合期限且待续费的合约；已续费或无需续费对象排除';
    }else if(rule.type==='hours_remaining'){
        if(c.hours.status==='unknown'){state='unknown';reason=c.hours.reason;}
        else if(c.hours.status==='ready'){state=value(c.hours.remaining!>0&&c.hours.remaining!<=rule.maximumHours);reason='截至 '+c.asOf+'，同课程有效合约净余额 '+c.hours.remaining+' 课时；'+c.hours.reason;}
        else reason=c.hours.reason;
    }else {
        const start=Date.parse(c.asOf+'T00:00:00+08:00')-(rule.lookbackDays-1)*86400000,count=c.complaints.filter(v=>Date.parse(v.occurredAt)>=start).length;
        if(!c.complaintsComplete){state='unknown';reason='客诉数据尚未完整导入';}else {state=value(count>=rule.minimumCount);reason='截至 '+c.asOf+'，最近 '+rule.lookbackDays+' 天发生 '+count+' 条客诉；不推断历史处理状态';}
    }
    return {condition:ruleDescription(rule),state,reason,campusId:c.campusId,courseId:c.courseId};
}
export function evaluateBusinessRule(snapshot:EducationSnapshot,scope:AuthorizedScope,rule:OperationalTagRuleDTO) {
    const facts=buildStudentBusinessFacts(snapshot,scope),leaves=rule.type==='all'||rule.type==='any'?rule.conditions:[rule];
    const evaluated=facts.contexts.map(c=>{const matches=leaves.map(r=>evaluateLeaf(c,r)),states=matches.map(m=>m.state),any=rule.type==='any';
        const state:RuleMatch['state']=any?(states.includes('true')?'true':states.includes('unknown')?'unknown':'false'):(states.includes('false')?'false':states.includes('unknown')?'unknown':'true');return {context:c,matches,state};});
    const students=new Map<string,typeof evaluated>();for(const e of evaluated){let list=students.get(e.context.studentId);if(!list){list=[];students.set(e.context.studentId,list);}list.push(e);}
    const members:OperationalTagMember[]=[];let unknown=0,unmatched=0;
    for(const list of students.values()){
        const matched=list.filter(e=>e.state==='true');if(!matched.length){if(list.some(e=>e.state==='unknown'))unknown++;else unmatched++;continue;}
        const c=list[0].context,a=facts.attendance.students.find(s=>s.studentId===c.studentId);
        members.push({...a,studentId:c.studentId,displayName:c.displayName,gradeBand:c.gradeBand,campusIds:[...new Set(matched.map(m=>m.context.campusId))],courseIds:[...new Set(matched.map(m=>m.context.courseId))],reason:matched.map(m=>m.context.campusName+' / '+m.context.courseName+'：'+m.matches.filter(v=>v.state==='true').map(v=>v.reason).join('；')).join(' | '),matches:matched.flatMap(m=>m.matches),business:matched.map(m=>m.context)});
    }
    return {...facts,members,evaluation:{matched:members.length,unmatched,unknown,conditions:leaves.map((r,i)=>{const hits=new Set(evaluated.filter(e=>e.matches[i].state==='true').map(e=>e.context.studentId));return {condition:ruleDescription(r),matched:hits.size,unknown:new Set(evaluated.filter(e=>e.matches[i].state==='unknown'&&!hits.has(e.context.studentId)).map(e=>e.context.studentId)).size};})}};
}

import {RISK_PREVIEW_TTL_MS} from '../contracts/risk';
import type {AttendanceRiskRuleDTO,RiskPreviewVO} from '../contracts/risk';
import type {StudentAttendanceVO,EducationSnapshot} from '@/modules/education/contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
export const riskKinds=['campus','course','student','class','enrollment','lesson','attendance'] as const;
export function assertPreviewable(snapshot:EducationSnapshot,complete:boolean){
    if(snapshot.dataset.origin!=='simulated')throw new WorkflowError('当前出勤风险规则需要逐课签到，公开学习点击数据不适用',400);
    if(snapshot.batches.some(b=>['running','validating'].includes(b.status)))throw new WorkflowError('数据导入进行中，请完成后重新预览');
    if(!complete)throw new WorkflowError('学员、班级、在班、课表和签到数据尚未完整导入',400);
}
export function selectRiskMembers(students:readonly StudentAttendanceVO[],rule:AttendanceRiskRuleDTO):RiskPreviewVO['members'] {
    return students.filter(s=>s.due>=rule.minimumDue&&(rule.type==='absence_count'?s.absent>=rule.minimumAbsences:s.unknown===0&&s.present/s.due*100<rule.thresholdPercent))
        .map(s=>({...s,reason:rule.type==='absence_count'?'已确认缺勤 '+s.absent+' 次，达到 '+rule.minimumAbsences+' 次阈值':'出勤 '+s.present+'/'+s.due+'，低于 '+rule.thresholdPercent+'%'}));
}
export function assertConfirmation(p:{version:number;status:string;preview:RiskPreviewVO|null},version:number,token:string){
    if(p.version!==version||!p.preview||p.preview.ruleVersion!==version||p.preview.token!==token)throw new WorkflowError('草稿版本或预览已变化，请重新预览并确认',409,'VERSION_CONFLICT');
    // 已发布对象可重复确认；尚未发布的凭证在半小时后必须重新预览。
    const age=Date.now()-Date.parse(p.preview.createdAt);
    if(p.status!=='published'&&(!Number.isFinite(age)||age<0||age>=RISK_PREVIEW_TTL_MS))throw new WorkflowError('预览已过期，请重新预览后确认',409,'PREVIEW_EXPIRED');
}

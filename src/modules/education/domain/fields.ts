import type {RecordKind} from '../contracts';
export interface FieldDefinition {name: string; type: 'string' | 'number' | 'date' | 'datetime'; required: boolean; choices?: readonly string[]; description: string;}
const field = (name: string, type: FieldDefinition['type'] = 'string', required = true, description = name, choices?: readonly string[]): FieldDefinition => ({name, type, required, description, choices});
const id = field('id', 'string', true, '来源记录唯一编号');
const located = [field('campusId'), field('courseId')];
export const fields: Record<RecordKind, FieldDefinition[]> = {
    finance_annual:[id,field('year','number'),field('revenue','string',true,'人民币元，保留两位小数'),field('cost'),field('selling'),field('administrative'),field('sourceUrl'),field('sourcePage','number'),field('disclosedAt','date'),field('sourceVersion'),field('originalUnit'),field('historicalSources','string',false,'旧披露事实JSON')],
    campus: [id, field('name')],
    course: [id, field('name')],
    student: [id, field('displayName'), field('gradeBand', 'string', false)],
    class: [id, field('name'), ...located, field('capacity', 'number'), field('startDate', 'date'), field('endDate', 'date')],
    enrollment: [id, field('studentId'), field('classId'), field('startDate', 'date'), field('endDate', 'date', false), field('endReason','string',false,'结束原因',['completed','withdrawn','transferred'])],
    contract: [id, field('studentId'), ...located, field('purchasedHours', 'number'), field('signedAt', 'datetime'), field('endDate', 'date'), field('leadId','string',false,'来源线索；续费合约不重复归因招生'), field('renewalEligible','string',false,'到期是否需续费',['yes','no'])],
    lesson: [id, field('classId'), field('startsAt', 'datetime'), field('hours', 'number'), field('status', 'string', true, '取消课不计入应出勤', ['completed', 'cancelled'])],
    attendance: [id, field('lessonId'), field('studentId'), field('status', 'string', true, '请假单列，未知不当作缺勤', ['present', 'absent', 'leave', 'unknown']), field('recordedAt', 'datetime')],
    hours: [id, field('contractId'), field('studentId'), field('lessonId'), field('hours', 'number'), field('occurredAt', 'datetime'), field('status', 'string', true, '撤销记录冲减课耗', ['consumed', 'reversed'])],
    lead: [id, ...located, field('channelId'), field('acquiredAt', 'datetime'), field('status', 'string', true, '线索状态', ['new', 'converted', 'lost'])],
    trial: [id, field('leadId'), ...located, field('occurredAt', 'datetime'), field('status', 'string', true, '试听状态', ['attended', 'no_show'])],
    renewal: [id, field('studentId'), field('contractId'), field('newContractId'), field('occurredAt', 'datetime'), field('amount', 'number')],
    referral: [id, field('studentId'), field('leadId'), field('occurredAt', 'datetime')],
    complaint: [id, field('studentId'), ...located, field('occurredAt', 'datetime'), field('category'), field('status', 'string', true, '客诉处理状态', ['open', 'resolved'])],
    refund: [id, field('studentId'), field('contractId'), field('occurredAt', 'datetime'), field('amount', 'number'), field('refundedHours', 'number'), field('status', 'string', true, '仅完成退款调整合约课时', ['completed', 'revoked'])],
    oulad_course: [field('code_module'), field('code_presentation'), field('module_presentation_length', 'number')],
    oulad_student: [field('code_module'), field('code_presentation'), field('id_student'), field('gender'), field('region'), field('highest_education'), field('imd_band', 'string', false), field('age_band'), field('num_of_prev_attempts', 'number'), field('studied_credits', 'number'), field('disability'), field('final_result')],
    oulad_registration: [field('code_module'), field('code_presentation'), field('id_student'), field('date_registration', 'number', false), field('date_unregistration', 'number', false)],
    oulad_assessment: [field('code_module'), field('code_presentation'), field('id_assessment'), field('assessment_type'), field('date', 'number', false), field('weight', 'number')],
    oulad_resource: [field('id_site'), field('code_module'), field('code_presentation'), field('activity_type'), field('week_from', 'number', false), field('week_to', 'number', false)],
    oulad_activity: [field('code_module'), field('code_presentation'), field('id_student'), field('id_site'), field('date', 'number'), field('sum_click', 'number')],
    oulad_submission: [field('id_assessment'), field('id_student'), field('date_submitted', 'number'), field('is_banked', 'number'), field('score', 'number', false)],
};
export const kindLabels: Record<RecordKind, string> = {finance_annual:'公开年度财务',campus:'校区',course:'课程',student:'学员',class:'班级',enrollment:'在班记录',contract:'报名合约',lesson:'课表',attendance:'签到',hours:'课耗',lead:'线索',trial:'试听',renewal:'续费',referral:'转介绍',complaint:'客诉',refund:'退款',oulad_course:'OULAD课程批次',oulad_student:'OULAD学员信息',oulad_registration:'OULAD注册退出',oulad_assessment:'OULAD测评定义',oulad_resource:'OULAD学习资源',oulad_activity:'OULAD按日学习活动',oulad_submission:'OULAD测评提交'};

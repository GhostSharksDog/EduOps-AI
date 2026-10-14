import type {EducationRow, QualityIssue, StoredEducationRow} from '../contracts';

// 一次流式导入复用索引，仅基础表与必要经营关联进入此索引。
export class EducationReferenceIndex {
    readonly records=new Map<string,EducationRow>();
    readonly assessments=new Map<string,EducationRow>();
    readonly memberships=new Map<string,EducationRow[]>();
    constructor(rows:readonly EducationRow[]=[]){this.add(rows);}
    add(rows:readonly EducationRow[]){
        for(const row of rows){
            const key=row.kind+':'+row.sourceId,previous=this.records.get(key);this.records.set(key,row);
            if(row.kind==='oulad_assessment')this.assessments.set(String(row.payload.id_assessment),row);
            if(row.kind==='enrollment'){
                const membershipKey=row.payload.studentId+':'+row.payload.classId;
                const members=this.memberships.get(membershipKey)??[];
                if(previous){const index=members.findIndex(r=>r.sourceId===row.sourceId);if(index>=0)members[index]=row;else members.push(row);}else members.push(row);
                this.memberships.set(membershipKey,members);
            }
        }
    }
}

export function validateReferences(rows: EducationRow[], existing: StoredEducationRow[]|EducationReferenceIndex): QualityIssue[] {
    const index=existing instanceof EducationReferenceIndex?existing:new EducationReferenceIndex(existing);
    // 本块引用可覆盖基础索引，但不复制全部基础Map、不污染失败块后的缓存。
    const local=new EducationReferenceIndex(rows);
    const records={get:(key:string)=>local.records.get(key)??index.records.get(key),has:(key:string)=>local.records.has(key)||index.records.has(key)};
    const issues: QualityIssue[] = [];
    const assessments={get:(key:string)=>local.assessments.get(key)??index.assessments.get(key)};
    const memberships={get:(key:string)=>[...(local.memberships.get(key)??[]),...(index.memberships.get(key)??[])]};
    const required: Record<string, [string, string][]> = {
        class: [['campusId','campus'],['courseId','course']],
        enrollment: [['studentId','student'],['classId','class']],
        contract: [['studentId','student'],['campusId','campus'],['courseId','course']],
        lesson: [['classId','class']], attendance: [['lessonId','lesson'],['studentId','student']],
        hours: [['contractId','contract'],['studentId','student'],['lessonId','lesson']],
        lead: [['campusId','campus'],['courseId','course']], trial: [['leadId','lead'],['campusId','campus'],['courseId','course']],
        renewal: [['studentId','student'],['contractId','contract'],['newContractId','contract']], referral: [['studentId','student'],['leadId','lead']],
        complaint: [['studentId','student'],['campusId','campus'],['courseId','course']], refund: [['studentId','student'],['contractId','contract']],
    };
    rows.forEach((row, index) => {
        for (const [field, kind] of required[row.kind] ?? []) {
            if (!records.has(kind + ':' + row.payload[field])) issues.push({row:index+2,field,reason:'关联记录不存在，请先导入对应基础数据'});
        }
        const lesson = records.get('lesson:' + row.payload.lessonId);
        if (lesson) {
            const classroom = records.get('class:' + lesson.payload.classId);
            if (classroom) {row.classId=classroom.sourceId;row.courseId=String(classroom.payload.courseId);row.campusId=String(classroom.payload.campusId);}
            if(row.kind==='attendance')row.occurredAt = String(lesson.payload.startsAt);
            if (row.kind === 'hours' && lesson.payload.status === 'cancelled') issues.push({row:index+2,field:'lessonId',reason:'取消课程不能扣课时'});
            if(row.kind==='hours'){const c=records.get('contract:'+row.payload.contractId);if(c&&classroom&&(c.payload.courseId!==classroom.payload.courseId||c.payload.campusId!==classroom.payload.campusId))issues.push({row:index+2,field:'contractId',reason:'扣课合约的课程或校区与课次不一致'});}
            if (row.kind === 'attendance') {
                const enrollment = (memberships.get(row.payload.studentId + ':' + lesson.payload.classId) ?? []).find(r => String(r.payload.startDate) <= String(lesson.payload.startsAt).slice(0,10) && (!r.payload.endDate || String(r.payload.endDate) > String(lesson.payload.startsAt).slice(0,10)));
                if (!enrollment) issues.push({row:index+2,field:'studentId',reason:'学员在该课次不属于有效在班成员'});
            }
        }
        const contract = records.get('contract:' + row.payload.contractId);
        if (contract && row.payload.studentId && contract.payload.studentId !== row.payload.studentId) issues.push({row:index+2,field:'contractId',reason:'合约不属于该学员'});
        const invalid=(field:string,reason:string)=>issues.push({row:index+2,field,reason});
        if(row.kind==='contract'){
            if(row.payload.leadId){const lead=records.get('lead:'+row.payload.leadId);if(!lead)invalid('leadId','来源线索不存在，请先导入线索');else if(lead.campusId!==row.campusId||lead.courseId!==row.courseId||Date.parse(String(row.payload.signedAt))<Date.parse(String(lead.payload.acquiredAt)))invalid('leadId','签约的校区课程或时间与来源线索不一致');}
            if(String(row.payload.signedAt).slice(0,10)>String(row.payload.endDate))invalid('endDate','合约到期早于签约时间');
        }
        if(row.kind==='enrollment'&&row.payload.endReason&&!row.payload.endDate)invalid('endReason','结束原因必须有结束日期');
        if(row.kind==='trial'){const lead=records.get('lead:'+row.payload.leadId);if(lead&&(lead.campusId!==row.campusId||lead.courseId!==row.courseId||Date.parse(String(row.payload.occurredAt))<Date.parse(String(lead.payload.acquiredAt))))invalid('leadId','试听的校区课程或时间与线索不一致');}
        if(row.kind==='renewal'&&contract){const next=records.get('contract:'+row.payload.newContractId);if(next){if(next.sourceId===contract.sourceId||next.payload.studentId!==row.payload.studentId||next.payload.campusId!==contract.payload.campusId||next.payload.courseId!==contract.payload.courseId)invalid('newContractId','续费新旧合约须不同且属于同一学员、校区和课程');if(Date.parse(String(next.payload.signedAt))<Date.parse(String(contract.payload.signedAt))||Date.parse(String(row.payload.occurredAt))<Date.parse(String(next.payload.signedAt)))invalid('occurredAt','续费时间早于新合约签约或新合约早于旧合约');row.campusId=String(contract.payload.campusId);row.courseId=String(contract.payload.courseId);}}
        if(row.kind==='refund'&&contract){row.campusId=String(contract.payload.campusId);row.courseId=String(contract.payload.courseId);if(Date.parse(String(row.payload.occurredAt))<Date.parse(String(contract.payload.signedAt)))invalid('occurredAt','退款时间早于签约时间');}
        if(row.kind.startsWith('oulad_') && row.kind!=='oulad_course'){
            const p=row.payload,key=p.code_module+':'+p.code_presentation;
            if(p.code_module&&!records.has('oulad_course:'+key+':course'))issues.push({row:index+2,field:'code_module',reason:'课程批次不存在'});
            if(['oulad_registration','oulad_activity'].includes(row.kind)&&!records.has('oulad_student:'+key+':'+p.id_student))issues.push({row:index+2,field:'id_student',reason:'课程批次中的学员不存在'});
            if(row.kind==='oulad_activity'&&!records.has('oulad_resource:'+key+':'+p.id_site))issues.push({row:index+2,field:'id_site',reason:'课程学习资源不存在'});
            if(row.kind==='oulad_submission'){const a=assessments.get(String(p.id_assessment));if(!a)issues.push({row:index+2,field:'id_assessment',reason:'测评定义不存在'});else{row.courseId=a.payload.code_module+':'+a.payload.code_presentation;if(!records.has('oulad_student:'+row.courseId+':'+p.id_student))issues.push({row:index+2,field:'id_student',reason:'测评所属课程的学员不存在'});}}
        }
    });
    return issues;
}

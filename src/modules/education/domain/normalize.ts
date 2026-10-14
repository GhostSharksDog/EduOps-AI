import {z} from 'zod';
import {datasetAnalysisType,type DatasetVO,type EducationRow,type QualityIssue,type RecordKind} from '../contracts';
import {fields} from './fields';

export function normalizeRows(dataset: DatasetVO, kind: RecordKind, input: Record<string, string>[], mapping: Record<string, string>, filename: string, rowOffset = 0) {
    const rows: EducationRow[] = [], issues: QualityIssue[] = [],sourceRows:number[]=[];
    let rejectedRows = 0;
    const mode=datasetAnalysisType(dataset),rowMode=kind==='finance_annual'?'finance':kind.startsWith('oulad_')?'learning':'operations';
    if(mode!==rowMode)throw new Error('经营、公开学习与财务案例必须使用独立数据集及明确的分析类型');
    // 第一版继续使用原字段集合和内容指纹，不能因新增可选字段破坏重复导入。
    const selectedFields=fields[kind].filter(f=>dataset.schemaVersion!=='1'||!['contract','enrollment'].includes(kind)||!['leadId','renewalEligible','endReason'].includes(f.name));
    const shape: Record<string, z.ZodType> = {};
    for (const f of selectedFields) {
        let validator: z.ZodType = f.type === 'number' ? z.number().finite() : f.type === 'date' ? z.iso.date() : f.type === 'datetime' ? z.iso.datetime({offset: true}) : z.string().trim().min(1).max(1000);
        if (f.choices) validator = z.enum(f.choices as [string, ...string[]]);
        if (!f.required) validator = validator.nullable();
        shape[f.name] = validator;
    }
    const schema = z.object(shape).strict();
    input.forEach((row, index) => {
        const candidate: Record<string, unknown> = {};
        for (const f of selectedFields) {
            const value = row[mapping[f.name] ?? f.name];
            const empty = value === undefined || value === '' || value === '?';
            candidate[f.name] = empty ? null : f.type === 'number' ? Number(value) : value;
        }
        const parsed = schema.safeParse(candidate);
        const errors: QualityIssue[] = parsed.success ? [] : parsed.error.issues.map(i => ({row: rowOffset + index + 2, field: i.path.join('.'), reason: i.message}));
        if (parsed.success) {
            const p = parsed.data;
            if(kind==='finance_annual'){
                for(const key of ['revenue','cost','selling','administrative'])if(!/^\d{1,13}\.\d{2}$/.test(String(p[key])))errors.push({row:rowOffset+index+2,field:key,reason:'金额须为非负人民币元，保留两位小数'});
                if(!Number.isInteger(p.year)||Number(p.year)<2000||Number(p.year)>2100)errors.push({row:rowOffset+index+2,field:'year',reason:'年度无效'});
                if(!Number.isInteger(p.sourcePage)||Number(p.sourcePage)<1||p.originalUnit!=='CNY yuan')errors.push({row:rowOffset+index+2,field:'sourcePage',reason:'须保留原始页码及人民币元单位'});
                if(!z.url().safeParse(p.sourceUrl).success)errors.push({row:rowOffset+index+2,field:'sourceUrl',reason:'来源须为完整URL'});
                if(p.historicalSources){try{if(!Array.isArray(JSON.parse(String(p.historicalSources))))throw Error();}catch{errors.push({row:rowOffset+index+2,field:'historicalSources',reason:'历史来源须为JSON数组'});}}
                if(String(p.disclosedAt)+'T00:00:00.000Z'>dataset.dataCutoff)errors.push({row:rowOffset+index+2,field:'disclosedAt',reason:'披露日晚于来源截止日'});
            }
            for (const name of ['capacity', 'purchasedHours', 'hours', 'amount', 'refundedHours', 'sum_click', 'module_presentation_length']) {
                if (typeof p[name] === 'number' && (p[name] < 0 || (['capacity', 'purchasedHours', 'hours'].includes(name) && p[name] === 0))) errors.push({row:rowOffset+index+2, field:name, reason:'数量必须满足非负或正数约束'});
            }
            if (p.startDate && p.endDate && String(p.startDate) > String(p.endDate)) errors.push({row:rowOffset+index+2, field:'endDate', reason:'结束日期不能早于开始日期'});
            if (typeof p.capacity === 'number' && !Number.isInteger(p.capacity)) errors.push({row:rowOffset+index+2,field:'capacity',reason:'班额必须是整数'});
        }
        if (errors.length || !parsed.success) {rejectedRows++; issues.push(...errors); return;}
        const payload = parsed.data;
        let sourceId = String(payload.id ?? '');
        if (kind.startsWith('oulad_')) {
            sourceId = [payload.code_module, payload.code_presentation, payload.id_student ?? payload.id_assessment ?? payload.id_site ?? 'course'].filter(v => v !== undefined).join(':');
            // 日汇总记录仍使用原文件行号，保留原始重复行，不擅自改写公开数据总量。
            if (['oulad_activity','oulad_submission'].includes(kind)) sourceId = filename + ':' + (rowOffset + index + 1);
        }
        const occurred = payload.startsAt ?? payload.recordedAt ?? payload.occurredAt ?? payload.signedAt ?? payload.acquiredAt;
        if (occurred && new Date(String(occurred)) > new Date(dataset.dataCutoff)) {rejectedRows++; issues.push({row:rowOffset+index+2,field:'occurredAt',reason:'事件晚于数据集截止时间'}); return;}
        rows.push({sourceId, kind, payload, studentId: String(payload.studentId ?? (payload.id_student ? 'oulad:student:' + payload.id_student : '')), campusId: String(payload.campusId ?? ''), courseId: String(payload.courseId ?? (payload.code_module ? payload.code_module + ':' + payload.code_presentation : '')), classId: String(payload.classId ?? ''), occurredAt: occurred ? new Date(String(occurred)).toISOString() : null, relativeDay: typeof (payload.date ?? payload.date_submitted) === 'number' ? Number(payload.date ?? payload.date_submitted) : null});
        sourceRows.push(rowOffset+index+2);
    });
    return {rows, rejectedRows, issues,sourceRows};
}

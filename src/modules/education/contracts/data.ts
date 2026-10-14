import {z} from 'zod';

export const datasetSchema = z.object({
    key: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
    name: z.string().trim().min(1).max(120),
    origin: z.enum(['public', 'simulated']),
    analysisType:z.enum(['operations','learning','finance']).optional(),
    sourceUrl: z.string().url().optional(),
    license: z.string().min(1).max(120),
    schemaVersion: z.enum(['1','2','3']),
    dataCutoff: z.iso.datetime(),
    description: z.string().max(2000).default(''),
    expectedRows:z.record(z.string(),z.number().int().min(0)).optional(),
}).strict().superRefine((value, ctx) => {
    if (value.origin === 'public' && !value.sourceUrl) ctx.addIssue({code: 'custom', path: ['sourceUrl'], message: '公开数据必须记录来源'});
    if(value.analysisType&&((value.origin==='simulated'&&value.analysisType!=='operations')||(value.origin==='public'&&value.analysisType==='operations')))ctx.addIssue({code:'custom',path:['analysisType'],message:'来源与分析类型不一致'});
});
export type DatasetDTO = z.infer<typeof datasetSchema>;
export interface DatasetVO extends DatasetDTO {id: string; createdAt: string;}

export function datasetAnalysisType(d:Pick<DatasetVO,'key'|'origin'|'analysisType'>){return d.analysisType??(d.origin==='simulated'?'operations':d.key.startsWith('oulad')?'learning':null);}
export const recordKinds = ['campus', 'course', 'student', 'class', 'enrollment', 'contract', 'lesson', 'attendance', 'hours', 'lead', 'trial', 'renewal', 'referral', 'complaint', 'refund', 'oulad_course', 'oulad_student', 'oulad_registration', 'oulad_assessment', 'oulad_resource', 'oulad_activity', 'oulad_submission','finance_annual'] as const;
export type RecordKind = typeof recordKinds[number];
export const metadataKinds: readonly RecordKind[] = ['campus', 'course', 'student', 'class', 'enrollment', 'contract', 'oulad_course', 'oulad_student', 'oulad_registration', 'oulad_assessment', 'oulad_resource','finance_annual'];
export interface EducationRow {sourceId: string; kind: RecordKind; payload: Record<string, unknown>; studentId: string; campusId: string; courseId: string; classId: string; occurredAt: string | null; relativeDay: number | null;}
export interface StoredEducationRow extends EducationRow {batchId: string; hash: string;}
export interface QualityIssue {row: number; field: string; reason: string;}
export interface ImportResultVO {id: string; datasetId: string; kind: RecordKind; filename: string; status: 'validating' | 'running' | 'completed' | 'failed'; inputRows: number; acceptedRows: number; rejectedRows: number; duplicateRows: number; issues: QualityIssue[]; createdAt: string; completedAt: string | null; error: string | null; fileHash: string;reused?:boolean;importProcess?:{pid:number;host:string;runId:string};}
export interface ImportInput {datasetId: string; kind: RecordKind; filename: string; csv: string; mapping: Record<string, string>; rowOffset?: number; dryRun?: boolean;}
export const importInputSchema = z.object({datasetId: z.uuid(), kind: z.enum(recordKinds), filename: z.string().min(1).max(160), csv: z.string().min(1).max(8 * 1024 * 1024), mapping: z.record(z.string(), z.string()).default({}), rowOffset: z.number().int().min(0).default(0), dryRun: z.boolean().default(false)}).strict();
export interface EducationSnapshot {dataset: DatasetVO; records: StoredEducationRow[]; batches: ImportResultVO[];}
export interface EducationStorage {
    createDataset(organizationId: string, input: DatasetDTO): Promise<DatasetVO>;
    listDatasets(organizationId: string): Promise<DatasetVO[]>;
    getDataset(organizationId: string, id: string): Promise<DatasetVO>;
    listBatches(organizationId: string, datasetId: string): Promise<ImportResultVO[]>;
    findBatch(organizationId: string, datasetId: string, fingerprint: string): Promise<ImportResultVO | null>;
    createBatch(organizationId: string, input: ImportInput, fingerprint: string): Promise<ImportResultVO>;
    finishBatch(id: string, result: Pick<ImportResultVO, 'status' | 'inputRows' | 'acceptedRows' | 'rejectedRows' | 'duplicateRows' | 'issues' | 'error'>): Promise<ImportResultVO>;
    readRecords(organizationId: string, datasetId: string, kinds?: readonly RecordKind[], batchIds?:readonly string[]): Promise<StoredEducationRow[]>;
    studentBatches?(organizationId:string,datasetId:string,kinds:readonly RecordKind[],batchIds:readonly string[],pageSize:number):AsyncIterable<StoredEducationRow[]>;
    findRecords(organizationId: string, datasetId: string, kind: RecordKind, ids: string[], completedBatchIds?: readonly string[]): Promise<StoredEducationRow[]>;
    // 仅显式CLI恢复已终止进程使用；常规页面不能把运行中的任务改成成功。
    recoverStoppedBatches?(organizationId: string, datasetId: string, batchIds: readonly string[], expectedOwners: Record<string,string>): Promise<ImportResultVO[]>;
    assertSourceFiles?(organizationId: string, datasetId: string, files: readonly {kind:RecordKind;filename:string;sha256:string}[]): Promise<void>;
    writeRecords(organizationId: string, datasetId: string, batchId: string, rows: StoredEducationRow[]): Promise<void>;
}

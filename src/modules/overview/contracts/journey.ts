import {z} from 'zod';
import {analysisScopeSchema} from '@/shared/contracts/analysis';
export const journeyQuerySchema=z.object({datasetId:z.uuid(),scope:analysisScopeSchema,runId:z.uuid().optional(),proposalId:z.uuid().optional(),snapshotId:z.uuid().optional(),reportId:z.uuid().optional(),taskId:z.uuid().optional()}).strict();
export type JourneyQuery=z.infer<typeof journeyQuerySchema>;
export interface JourneyVO {ready:boolean[];records:Partial<Record<'runId'|'sessionId'|'proposalId'|'snapshotId'|'reportId'|'taskId',string>>;reports:{id:string;label:string}[];blockers:{message:string;href:string}[];warnings:string[];}

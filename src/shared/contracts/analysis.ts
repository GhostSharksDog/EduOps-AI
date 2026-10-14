import {z} from 'zod';

export const capabilityStatusSchema=z.enum(['ready','unconfigured','not_implemented','error']);
export type CapabilityStatus=z.infer<typeof capabilityStatusSchema>;
export interface Capability {id:string;name:string;status:CapabilityStatus;description:string;href:string;}
export const analysisScopeSchema=z.object({
 startDate:z.iso.date(),endDate:z.iso.date(),campusIds:z.array(z.string()).default([]),
 courseIds:z.array(z.string()).default([]),channelIds:z.array(z.string()).default([]),dataCutoff:z.iso.datetime().optional(),
}).strict().refine(s=>s.startDate<=s.endDate,{message:'开始日期不能晚于结束日期',path:['endDate']});
export type AnalysisScope=z.infer<typeof analysisScopeSchema>;
export interface AuthorizedScope extends AnalysisScope {organizationId:string;authorizedCampusIds:readonly string[];observationCutoff?:string;}
export const learningScopeSchema=z.object({courseKeys:z.array(z.string().min(1).max(80)).max(100).default([]),relativeDayStart:z.number().int().min(-10000).max(10000).optional(),relativeDayEnd:z.number().int().min(-10000).max(10000).optional()}).strict().refine(s=>s.relativeDayStart===undefined||s.relativeDayEnd===undefined||s.relativeDayStart<=s.relativeDayEnd,{message:'起始相对日不能晚于结束相对日',path:['relativeDayEnd']});
export type LearningScope=z.infer<typeof learningScopeSchema>;
export interface AuthorizedLearningScope extends LearningScope {organizationId:string;}
export const financeScopeSchema=z.object({years:z.array(z.number().int().min(2000).max(2100)).max(30).default([])}).strict();
export type FinanceScope=z.infer<typeof financeScopeSchema>;
export interface AuthorizedFinanceScope extends FinanceScope {organizationId:string;}
export type AuthorizedAnalysisScope=AuthorizedScope|AuthorizedLearningScope|AuthorizedFinanceScope;
export const isLearningScope=(scope:AuthorizedAnalysisScope):scope is AuthorizedLearningScope=>'courseKeys' in scope;
export const isFinanceScope=(scope:AuthorizedAnalysisScope):scope is AuthorizedFinanceScope=>'years' in scope;
export interface EvidenceReference {id:string;kind:'metric'|'knowledge'|'tag'|'segment';sourceId:string;version:string;summary:string;scope?:AnalysisScope;learningScope?:LearningScope;financeScope?:FinanceScope;updatedAt:string;}
export interface DraftProposal {id:string;kind:'tag'|'segment';version:number;status:'draft'|'validated'|'awaiting_confirmation'|'published';name:string;rule:Record<string,unknown>;estimatedCount:number|null;evidence:EvidenceReference[];validationErrors:string[];}
export interface AgentRun {id:string;status:'queued'|'running'|'awaiting_confirmation'|'completed'|'failed';steps:{tool:string;status:'pending'|'completed'|'failed';evidence:EvidenceReference[]}[];proposals:DraftProposal[];error?:string;}
export interface CapabilityResult<T> {status:CapabilityStatus;message:string;data:T|null;}

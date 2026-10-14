import {z} from 'zod';
import {analysisScopeSchema,learningScopeSchema,financeScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedAnalysisScope, CapabilityResult, CapabilityStatus, EvidenceReference} from '@/shared/contracts/analysis';
import type {OperationalTagRuleDTO} from '@/modules/tag/contracts';
export {buildAnswer} from '../domain/answer';
export {agentAnswerFormatPrompt,agentFactReferencePrompt,agentAnswerRepairPrompt} from '../domain/answer';

export const agentRunInputSchema = z.object({
  message:z.string().trim().min(1).max(4000), requestKey:z.uuid(), sessionId:z.uuid().optional(),
  datasetId:z.uuid().optional(), scope:analysisScopeSchema.optional(),learningScope:learningScopeSchema.optional(),financeScope:financeScopeSchema.optional(),
}).strict().superRefine((input,ctx)=>{
  if(!input.sessionId&&(!input.datasetId||(!input.scope&&!input.learningScope&&!input.financeScope)))ctx.addIssue({code:'custom',message:'新会话须选择数据集和统计范围'});
  if([input.scope,input.learningScope,input.financeScope].filter(Boolean).length>1)ctx.addIssue({code:'custom',message:'经营、学习、财务范围须互斥'});
  if(input.sessionId&&(input.datasetId||input.scope||input.learningScope||input.financeScope))ctx.addIssue({code:'custom',message:'已有会话的统计范围固定，请新建会话改变范围'});
});
export const agentConfirmationSchema = z.object({runId:z.uuid(),proposalId:z.uuid(),version:z.number().int().positive(),previewToken:z.uuid()}).strict();
export type AgentRunDTO=z.infer<typeof agentRunInputSchema>;
export type AgentConfirmationDTO=z.infer<typeof agentConfirmationSchema>;
export type AgentRunStatus='queued'|'running'|'awaiting_confirmation'|'completed'|'failed';
export interface AgentActor {userId:string;organizationId:string;role:string;}
export interface AgentSessionVO {id:string;title:string;datasetId:string;scope:AuthorizedAnalysisScope;createdBy:string;editable:boolean;createdAt:string;updatedAt:string;}
export interface AgentMessageVO {id:string;sessionId:string;runId:string|null;role:'user'|'assistant';content:string;createdAt:string;}
export interface AgentFactVO {id:string;label:string;value:number|null;unit:string;status:string;numerator?:number|null;denominator?:number|null;evidenceIds:string[];}
export interface AgentAnswerVO {summary:string;facts:AgentFactVO[];hypotheses:string[];recommendations:string[];limitations:string[];}
export interface AgentProposalVO {id:string;kind:'tag';version:number;status:'draft'|'awaiting_confirmation'|'published';name:string;rule?:OperationalTagRuleDTO;ruleSummary?:string;observedCount?:number|null;unknownCount?:number|null;estimatedCount:number|null;previewToken:string|null;previewFingerprint:string|null;publishedTagId:string|null;evidence:EvidenceReference[];}
export interface AgentStepVO {id:string;tool:string;status:'pending'|'completed'|'failed';evidence:EvidenceReference[];input?:Record<string,unknown>;facts?:AgentFactVO[];errorCode?:string;errorMessage?:string;}
export interface AgentRunVO {id:string;sessionId:string;status:AgentRunStatus;steps:AgentStepVO[];proposals:AgentProposalVO[];evidence:EvidenceReference[];answer:AgentAnswerVO|null;errorCode:string|null;errorMessage:string|null;startedAt:string;completedAt:string|null;}
export interface AgentSessionDetailVO {session:AgentSessionVO;messages:AgentMessageVO[];runs:AgentRunVO[];}
export interface AgentService {run(input:AgentRunDTO,actor:AgentActor):Promise<CapabilityResult<AgentRunVO>>;}
export interface ToolDefinition {name:string;description:string;mode:'read'|'propose';status:CapabilityStatus;parameters?:Record<string,unknown>;}
export interface ToolExecutionContext {actor:AgentActor;runId:string;toolCallId:string;datasetId:string;signal:AbortSignal;proposalIds?:readonly string[];}
export interface AgentToolPayload {result:unknown;evidence:EvidenceReference[];facts:AgentFactVO[];proposal?:AgentProposalVO;}
export interface StoredAgentRun {run:AgentRunVO;session:AgentSessionVO;message:string;deadlineAt:string;}
export interface AgentProgressVO {prepared:boolean;run:AgentRunVO|null;deadlineAt:string|null;expired:boolean;}
export interface AgentRepository {
  findRunForProposal?(actor:AgentActor,proposalId:string):Promise<StoredAgentRun|undefined>;
  progress?(actor:AgentActor,requestKey:string):Promise<AgentProgressVO>;
  prepare(actor:AgentActor,input:AgentRunDTO,requestHash:string,scope?:AuthorizedAnalysisScope):Promise<{execution:StoredAgentRun;reused:boolean}>;
  save(actor:AgentActor,run:AgentRunVO):Promise<void>;
  finish(actor:AgentActor,run:AgentRunVO,expectedStatuses?:AgentRunStatus[]):Promise<boolean>;
  getRun(actor:AgentActor,id:string):Promise<StoredAgentRun>;
  listSessions(actor:AgentActor):Promise<AgentSessionVO[]>;
  getSession(actor:AgentActor,id:string):Promise<AgentSessionDetailVO>;
  history(actor:AgentActor,sessionId:string):Promise<AgentMessageVO[]>;
}

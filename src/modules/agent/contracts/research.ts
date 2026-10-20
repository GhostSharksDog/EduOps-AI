import {z} from 'zod';
import type {AgentRunStatus,AgentTurnContext} from './index';
import type {TaskState} from './task-state';

export const agentTaskComparisonSchema=z.object({oldRunId:z.uuid(),newRunId:z.uuid()}).strict().refine(v=>v.oldRunId!==v.newRunId,{message:'请选择两次不同的执行记录'});
export type AgentTaskGroup='guidance'|'analysis'|'tag'|'workflow'|'knowledge';
export type AgentTaskIntent=AgentTaskGroup|'compound'|'clarification';
export type AgentTaskMode='operations'|'learning'|'finance';
export interface AgentTaskRouting {
 intent:AgentTaskIntent;groups:AgentTaskGroup[];reason:string;
 switches?:number;history?:{round:number;groups:AgentTaskGroup[];reason:string}[];selectedToolNames?:string[];
}
export interface AgentFrozenEvidence {
 version:'agent-evidence-v1';datasetId:string;scopeKey:string;dataFingerprint:string;
 knowledgeVersions:{sourceId:string;version:string}[];frozenAt:string;
}
export interface AgentRuntimeVO {
 engineVersion:'business-agent-v1'|'business-agent-v2'|'business-agent-v3';model:string|null;promptVersion:string;recordedAt:string;
 input?:{version:'agent-input-v1';tools:unknown[];rounds:{round:number;messages:unknown[];usesTools:boolean;json:boolean;retryOfRound?:number;toolNames?:string[]}[]};
 inputSummary?:{recorded:boolean;calls:number;sha256:string};
 recovery?:{status:'waiting'|'recovered'|'failed';httpStatus:number;retryAt:string;round:number};
 taskRouting?:AgentTaskRouting;taskMemory?:TaskState;freeze?:AgentFrozenEvidence;
 recoveryOf?:{runId:string;kind:'interpretation';fingerprint:string};
 answerValidation?:{round:number;code:string;fields:string[]}[];
}
export interface AgentRunCandidate {id:string;sessionId:string;title:string;question:string;startedAt:string;status:AgentRunStatus;engineLabel:string;}
export interface TaskRunComparison {
 id:string;sessionId:string;question:string;startedAt:string;status:AgentRunStatus;
 engine:'v1'|'v2'|'v3'|'unknown';engineLabel:string;versionSource:'explicit'|'compatible'|'missing';
 executionKind:'task'|'interpretation_recovery';toolSelectionCalls:number;
 context:AgentTurnContext|null;contextSource:'frozen'|'legacy'|'missing';model:string|null;promptVersion:string|null;inputsRecorded:boolean;inputHash:string|null;modelCalls:number|null;
 interactions:number|null;tools:{attempted:number;completed:number;failed:number;argumentErrors:number;pending:number};
 facts:{total:number;verified:number;unknown:number;invalidFactIds:string[];invalidEvidenceIds:string[];consistent:boolean|null};
 dataVersions:string[];knowledgeVersions:string[];
 actions:{total:number;completed:number;failed:number;pending:number;state:string|null;formallyCompleted:boolean|null};
 limitations:string[];manualTaskCompletion:'pending';
}
export interface AgentTaskComparison {strict:boolean;limitations:string[];old:TaskRunComparison;new:TaskRunComparison;manualEvaluation:'pending';}

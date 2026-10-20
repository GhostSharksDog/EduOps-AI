import {z} from 'zod';

const shortText=z.string().trim().min(1).max(200);
export const taskObjectSchema=z.object({kind:z.enum(['tag','segment','report','task']),id:z.uuid(),version:z.number().int().positive().optional(),name:z.string().trim().min(1).max(200)}).strict();
export const taskStateSchema=z.object({revision:z.number().int().min(0).max(1000000000),goal:z.string().trim().min(1).max(500).nullable(),userConditions:z.array(shortText).max(8),selectedObjects:z.array(taskObjectSchema).max(8),pendingQuestions:z.array(z.string().trim().min(1).max(300)).max(3),datasetId:z.uuid(),scopeKey:z.string().min(1).max(128),needsReview:z.boolean(),updatedAt:z.iso.datetime({offset:true}),completionReceipt:z.object({runId:z.uuid(),planId:z.uuid(),revision:z.number().int().min(0).max(1000000000)}).strict().optional()}).strict();
export type AgentTaskState=z.infer<typeof taskStateSchema>;
export type TaskState=AgentTaskState;
export type TaskSelectedObject=z.infer<typeof taskObjectSchema>;
export interface TaskMemoryInput {goal?:string|null;userConditions?:string[];}
export interface TaskStateUpdate {expectedRevision:number;state:AgentTaskState;}
const revision=z.number().int().min(0).max(1000000000);
export const taskStatePatchSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('update'),expectedRevision:revision,goal:z.string().trim().min(1).max(500).nullable().optional(),userConditions:z.array(shortText).max(8).optional()}).strict().refine(v=>v.goal!==undefined||v.userConditions!==undefined,{message:'请提供目标或用户条件'}),
 z.object({action:z.literal('clear'),expectedRevision:revision}).strict(),
]);
export type AgentTaskStatePatch=z.infer<typeof taskStatePatchSchema>;

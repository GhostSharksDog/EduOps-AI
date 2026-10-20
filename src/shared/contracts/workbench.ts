import {z} from 'zod';

export const workbenchQuerySchema=z.object({type:z.enum(['all','task','plan','material']).default('all'),page:z.coerce.number().int().min(1).max(1000).default(1)}).strict();
export type WorkbenchQuery=z.infer<typeof workbenchQuerySchema>;
export type WorkbenchTodoType='task'|'plan'|'material';
export type WorkbenchKind=WorkbenchTodoType|'analysis'|'report'|'tag'|'segment';
export interface WorkbenchActor {organizationId:string;userId:string;role:string;}
export interface WorkbenchItem {
 id:string;kind:WorkbenchKind;title:string;status:string;statusLabel:string;updatedAt:string;
 href:string;actionLabel:string;canAct:boolean;dueDate?:string;overdue?:boolean;expiresAt?:string;version?:number;
 dataset?:{id:string;name:string;origin:'public'|'simulated';analysisType:'operations'|'learning'|'finance'|null};
 periodLabel?:string;
}
/** Module-owned reads are bounded metadata queries, never complete business snapshots. */
export interface WorkbenchReadOptions {todoLimit:number;recentLimit:number;today:string;}
export interface WorkbenchSourceData {count:number;todos:WorkbenchItem[];recent:WorkbenchItem[];}
export interface WorkbenchSourceStatus {status:'ready'|'error';message?:string;}
export interface WorkbenchResult {
 generatedAt:string;counts:Record<WorkbenchTodoType|'all',number|null>;
 todos:{items:WorkbenchItem[];page:number;pageSize:10;total:number|null;status:'ready'|'partial'|'error';message?:string;};
 recent:{items:WorkbenchItem[];status:'ready'|'partial'|'error';message?:string;};
 sources:Record<WorkbenchKind,WorkbenchSourceStatus>;
}

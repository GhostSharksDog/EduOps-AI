import {z} from 'zod';
import {analysisScopeSchema,learningScopeSchema,financeScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedScope,EvidenceReference,CapabilityStatus} from '@/shared/contracts/analysis';
import type {OperationalAnalysis,OperationalMetric} from '@/modules/analytics/contracts';
import type {AlertVO} from '@/modules/alert/contracts';
import type {ReportVO} from '@/modules/report/contracts';
import type {ChannelAnalysis} from '@/modules/analytics/contracts';
export const dashboardQuerySchema=z.object({datasetId:z.uuid(),scope:analysisScopeSchema.optional(),learningScope:learningScopeSchema.optional(),financeScope:financeScopeSchema.optional()}).strict().refine(v=>[v.scope,v.learningScope,v.financeScope].filter(Boolean).length===1,{message:'须提供经营、学习或财务范围，三者互斥'});
export interface ScopedDashboardItem {id:string;name:string;version:number;memberCount:number|null;status:string;ruleSummary?:string;dataCutoff:string;sourceFingerprint:string;historical:boolean;}
export interface DashboardResult {
    analysis:OperationalAnalysis;definitions:{code:string;name:string;numerator:string;denominator:string;notes:string;unit:string}[];
    history:{period:string;scope:AuthorizedScope;metrics:OperationalMetric[]}[];
    dimensions:{kind:'campus'|'course'|'channel';id:string;name:string;metrics:OperationalMetric[]}[];
    channelAnalysis?:Pick<ChannelAnalysis,'unknown'|'attributionVersion'|'notes'>;
    admission:{status:'ready'|'insufficient_data'|'not_applicable';leads:number|null;trials:number|null;afterTrial:number|null;direct:number|null;pending:number;reason:string;evidence:EvidenceReference[]};
    balances:{status:'ready'|'insufficient_data'|'not_applicable';asOf:string;values:{label:string;count:number}[];unknown:number;evidence:EvidenceReference[]};
    completeness:{kind:string;name:string;status:'complete'|'partial'|'missing';rows:number;expected:number|null}[];
    resources:{decisions?:{id:string;action:string;state:string;recordType:string;version:number;dataCutoff:string;historical:boolean}[];pendingDecisions?:number;status:CapabilityStatus;alerts:(AlertVO&{historicalBatch?:boolean})[];reports:(ReportVO&{historicalBatch?:boolean})[];proposals:ScopedDashboardItem[];snapshots:ScopedDashboardItem[];errors:string[]};
    sourceFingerprint:string;
}

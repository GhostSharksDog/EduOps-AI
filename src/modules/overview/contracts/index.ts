import type {AlertVO} from '@/modules/alert/contracts';
import type {ReportVO} from '@/modules/report/contracts';
import type {Capability,CapabilityStatus} from '@/shared/contracts/analysis';
export interface OverviewResult {operations?:OverviewOperations;databaseStatus:CapabilityStatus;configuration:{chatConfigured:boolean;embeddingConfigured:boolean};inventory:{tags:number;segments:number;dataSources:number;dataModels:number}|null;capabilities:Capability[];dataCutoff:null;riskSnapshots?:{status:CapabilityStatus;items:{id:string;name:string;memberCount:number;datasetName:string;origin:'simulated'|'public';startDate:string;endDate:string}[]};}

export interface OverviewOperations {alerts:{status:CapabilityStatus;items:AlertVO[]};reports:{status:CapabilityStatus;items:ReportVO[]};}
export * from './dashboard';
export * from './journey';

import {z} from 'zod';
import {analysisScopeSchema,type AuthorizedScope,type EvidenceReference} from '@/shared/contracts/analysis';
import type {OperationalAnalysis} from './index';
export const channelQuerySchema=z.object({datasetId:z.uuid(),scope:analysisScopeSchema}).strict();
export interface ChannelFunnel {
    leads:number;trialAttended:number;converted:number;afterTrial:number;direct:number;
    pending:number;missingLinks:number;windowDays:30;complete:boolean;
}
export interface ChannelAnalysisGroup {
    id:string;name:string;studentCount:number;contextCount:number;analysis:OperationalAnalysis;funnel:ChannelFunnel;
}
export interface ChannelAnalysis {
    dataset:OperationalAnalysis['dataset'];scope:AuthorizedScope;attributionVersion:string;
    options:{id:string;name:string}[];overall:OperationalAnalysis;groups:ChannelAnalysisGroup[];
    unknown:{studentCount:number;contextCount:number;reasons:{reason:string;contexts:number}[]};
    evidence:EvidenceReference[];notes:string[];
}

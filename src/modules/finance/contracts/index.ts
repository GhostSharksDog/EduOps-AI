import {z} from 'zod';
import {financeScopeSchema,type AuthorizedFinanceScope,type EvidenceReference} from '@/shared/contracts/analysis';
import type {DatasetVO} from '@/modules/education/contracts';
export const financeQuerySchema=z.object({datasetId:z.uuid(),financeScope:financeScopeSchema}).strict();
export const financeLabels={revenue:'营业收入',cost:'营业成本',grossProfit:'毛利',grossMargin:'毛利率',selling:'销售费用',sellingRatio:'销售费用率',administrative:'管理费用',administrativeRatio:'管理费用率'} as const;
export type FinanceCode=keyof typeof financeLabels;
export interface FinanceMetric {code:FinanceCode;label:string;value:number|null;unit:'元'|'%';previous:number|null;change:number|null;changeUnit:'%'|'百分点';evidence:EvidenceReference[];}
export interface FinanceAnnual {year:number;revenue:string;cost:string;selling:string;administrative:string;sourceUrl:string;sourcePage:number;disclosedAt:string;sourceVersion:string;originalUnit:string;historicalSources:unknown[];}
export interface FinanceAnalysis {analysisType:'finance';dataset:DatasetVO;scope:AuthorizedFinanceScope;years:number[];annual:FinanceAnnual[];metrics:FinanceMetric[];evidence:EvidenceReference[];sourceFingerprint:string;completeness:{expected:number;imported:number};limitations:string[];}

export {annualValues} from '../domain/annual';

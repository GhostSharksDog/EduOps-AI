export const metricCodes=['attendance_rate','class_fill_rate','hours_progress','admission_conversion','renewal_rate','retention_rate','complaint_count','refund_amount'] as const;
export const metricLabels:Record<string,string>={admission_conversion:'招生转化率',renewal_rate:'续费率',attendance_rate:'出勤率',class_fill_rate:'满班率',hours_progress:'课耗进度',retention_rate:'学员留存率',complaint_count:'客诉数量',refund_amount:'完成退款金额'};
import type {AuthorizedScope,CapabilityResult,EvidenceReference} from '@/shared/contracts/analysis';
export interface MetricDefinition {code:string;name:string;numerator:string;denominator:string;unit:'percent'|'count'|'hours'|'currency';notes:string;}
export interface MetricResult {code:string;unit?:MetricDefinition['unit'];value:number|null;numerator:number|null;denominator:number|null;scope:AuthorizedScope;evidence:EvidenceReference[];}
export interface AnalyticsService {query(metricCodes:string[],scope:AuthorizedScope):Promise<CapabilityResult<MetricResult[]>>;}
export interface AlertRule {id:string;metricCode:string;operator:'lt'|'gt'|'drop_percent';threshold:number;minimumDenominator:number;}
export interface OperationalMetric extends MetricResult {status:'ready'|'insufficient_data'|'not_applicable'|'not_implemented';reason:string;unknownCount:number;details:Record<string,number>;observationCutoff?:string;displayName?:string;}
export interface OperationalAnalysis {dataset:{id:string;name:string;origin:'public'|'simulated';sourceUrl?:string};scope:AuthorizedScope;metrics:OperationalMetric[];trend:{period:string;value:number|null;present:number;due:number;unknown:number}[];breakdown:{campusId:string;courseId:string;name:string;value:number|null;present:number;due:number;unknown:number}[];riskStudents:{studentId:string;displayName:string;absent:number;leave:number;unknown:number}[];batches:{id:string;kind:string;rows:number;hash:string}[];comparison?:{scope:AuthorizedScope;metrics:OperationalMetric[];changes:{code:string;change:number|null;unit:string;reason:string}[]};}
export * from './learning';
export * from './channels';

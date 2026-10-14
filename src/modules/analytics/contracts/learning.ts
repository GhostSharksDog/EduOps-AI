import {z} from 'zod';
import {learningScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedLearningScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {DatasetVO,RecordKind} from '@/modules/education/contracts';

export const learningMetricCodes=['student_count','enrollment_count','activity_count','click_count','active_student_count','average_active_days','average_score','withdrawal_count'] as const;
export type LearningMetricCode=typeof learningMetricCodes[number];
export const learningMetricLabels:Record<LearningMetricCode,string>={student_count:'匿名学员人数',enrollment_count:'学员课程记录数',activity_count:'学习活动记录数',click_count:'学习点击总量',active_student_count:'活跃学员人数',average_active_days:'平均活跃天数',average_score:'平均测评分数',withdrawal_count:'退出记录数'};
export const learningMetricDefinitions:Record<LearningMetricCode,string>={student_count:'所选课程批次名册中的去重匿名学员，不因相对日范围变化而减少',enrollment_count:'所选课程批次中学员与课程批次组合的记录数',activity_count:'相对日范围内原始来源活动行数，保留原文件的重复行',click_count:'相对日范围内sum_click之和；学习点击不能替代逐课签到',active_student_count:'相对日范围内有活动记录的去重匿名学员，跨课程去重',average_active_days:'每个学员课程批次的去重活跃日数，除以完整名册记录数，零活跃也计入分母',average_score:'相对日范围内非免修且评分已知的测评提交均分；缺失评分和免修提交单列',withdrawal_count:'date_unregistration落入相对日范围的学员课程记录数，不等同于最终学习结果人数'};
export const learningQuerySchema=z.object({datasetId:z.uuid(),learningScope:learningScopeSchema}).strict();
export interface LearningMetric {
 code:LearningMetricCode;label:string;value:number|null;unit:'人'|'条'|'次'|'天'|'分';
 status:'ready'|'insufficient_data';reason?:string;details?:Record<string,number>;
}
export interface LearningAnalysis {
 dataset:DatasetVO;scope:AuthorizedLearningScope;metrics:LearningMetric[];
 trend:{week:number;records:number;clicks:number;activeStudents:number}[];
 courses:{key:string;name:string;students:number;records:number;clicks:number;activeStudents:number}[];
 resources:{label:string;count:number}[];scores:{label:string;count:number}[];outcomes:{label:string;count:number}[];
 completeness:{kind:RecordKind;name:string;status:'complete'|'partial'|'missing';rows:number;expected:number|null}[];
 evidence:EvidenceReference[];batches:{id:string;kind:string;rows:number;hash:string}[];
 relativeDayBounds:{min:number|null;max:number|null};
}

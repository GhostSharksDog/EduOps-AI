import {CalculationRuleType, ComparisonOperator, TagValueType} from '@/shared/enums/index';

/**
 * 计算规则接口
 */
export interface CalculationRule {
    id?: string;
    ruleType: CalculationRuleType;
    tagValueType: TagValueType;
    expression: string;
    conditions?: {
        tagId: string;
        operator: ComparisonOperator;
        value: unknown;
    }[];
    dependencies?: string[];
    version?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * 单步骤 SQL 规则
 * 直接执行一条 SQL 语句生成标签值
 */
export interface SingleStepRule {
  /** 规则类型：SQL */
  ruleType: 'SQL';
  /** SQL 语句内容 */
  ruleContent: string;
  /** 依赖的数据模型 ID 列表 */
  dataModelIds: string[];
}

/**
 * 级联 MV 步骤
 * 定义级联物化视图中的一个步骤
 */
export interface CascadeStep {
  /** 步骤顺序 */
  order: number;
  /** 该步骤的 SQL 语句 */
  sql: string;
  /** 关联的目标表ID（可选） */
  targetTableId?: string;
}

/**
 * 级联 MV 规则
 * 通过多个 MV 步骤级联生成标签值
 */
export interface CascadeRule {
  /** 规则类型：CASCADE */
  ruleType: 'CASCADE';
  /** 级联步骤列表 */
  steps: CascadeStep[];
  /** 依赖的数据模型 ID 列表 */
  dataModelIds: string[];
}

/**
 * 标签计算规则联合类型
 */
export type TagCalculationRule = SingleStepRule | CascadeRule;

/**
 * 类型守卫：判断是否为级联规则
 */
export function isCascadeRule(rule: TagCalculationRule): rule is CascadeRule {
  return rule.ruleType === 'CASCADE';
}

/**
 * 类型守卫：判断是否为单步骤规则
 */
export function isSingleStepRule(rule: TagCalculationRule): rule is SingleStepRule {
  return rule.ruleType === 'SQL';
}

/**
 * 创建单步骤规则
 */
export function createSingleStepRule(
  ruleContent: string,
  dataModelIds: string[] = []
): SingleStepRule {
  return {
    ruleType: 'SQL',
    ruleContent,
    dataModelIds,
  };
}

/**
 * 创建级联规则
 */
export function createCascadeRule(
  steps: CascadeStep[],
  dataModelIds: string[] = []
): CascadeRule {
  return {
    ruleType: 'CASCADE',
    steps: steps.sort((a, b) => a.order - b.order),
    dataModelIds,
  };
}

/**
 * 验证规则是否有效
 */
export function validateRule(rule: TagCalculationRule): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.ruleType) {
    errors.push('ruleType is required');
  }

  if (isSingleStepRule(rule)) {
    if (!rule.ruleContent || rule.ruleContent.trim() === '') {
      errors.push('ruleContent is required for SQL rule');
    }
  }

  if (isCascadeRule(rule)) {
    if (!rule.steps || rule.steps.length === 0) {
      errors.push('steps is required for CASCADE rule');
    } else {
      rule.steps.forEach((step, index) => {
        if (!step.sql || step.sql.trim() === '') {
          errors.push(`steps[${index}].sql is required`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

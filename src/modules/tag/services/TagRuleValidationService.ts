/**
 * SQL 验证结果
 */
export class SqlValidationResult {
  constructor(
    public readonly valid: boolean,
    public readonly errors: string[] = []
  ) {}
}

/**
 * 规则验证结果
 */
export class RuleValidationResult {
  constructor(
    public readonly valid: boolean,
    public readonly errors: string[] = [],
    public readonly warnings: string[] = []
  ) {}
}

/**
 * 标签规则验证服务接口
 *
 * 架构说明:
 * 1. 验证 SQL 语法和依赖关系
 * 2. 验证标签规则的完整性
 * 3. 激活前的预校验
 *
 * 实现约束:
 * - 使用 node-sql-parser 进行 SQL 语法验证
 * - 不执行实际 SQL，只做静态分析
 */
export interface ITagRuleValidationService {
  /**
   * 验证 SQL 语法
   * @param sql SQL 语句
   * @returns 验证结果
   */
  validateSqlSyntax(sql: string): Promise<SqlValidationResult>;

  /**
   * 验证 SQL 依赖的数据模型
   * @param sql SQL 语句
   * @param dataModelIds 数据模型 ID 列表
   * @returns 验证结果
   */
  validateDependencies(
    sql: string,
    dataModelIds: string[]
  ): Promise<SqlValidationResult>;

  /**
   * 验证标签规则
   * @param rule 标签计算规则
   * @returns 验证结果
   */
  validateRule(rule: {
    ruleType: string;
    ruleContent?: string;
    steps?: Array<{ order: number; sql: string }>;
    dataModelIds?: string[];
  }): Promise<RuleValidationResult>;

  /**
   * 激活前的完整验证
   * @param tag 标签信息
   * @param version 版本信息
   * @returns 验证结果
   */
  validateForActivation(tag: {
    id: string;
    name: string;
    status: string;
  }, version: {
    id: string;
    versionNumber: number;
    status: string;
    calculationRule?: unknown;
  }): Promise<RuleValidationResult>;

  /**
   * 验证 INTERMEDIATE 目标表的 SQL 规则是否正确使用聚合函数
   * @param sql SQL 语句
   * @param aggregateConfig 聚合函数配置（仅 INTERMEDIATE 表需要）
   * @returns 验证结果
   */
  validateTargetTableMatch(
    sql: string,
    aggregateConfig: { functionName: string; stateCombinator: string } | null,
  ): Promise<SqlValidationResult>;
}

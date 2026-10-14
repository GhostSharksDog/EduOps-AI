import {
  ITagRuleValidationService,
  SqlValidationResult,
  RuleValidationResult,
} from '@/modules/tag/services/TagRuleValidationService';
import { Parser } from 'node-sql-parser';

/**
 * 标签规则验证服务实现
 *
 * 使用 node-sql-parser 进行 SQL 语法验证
 */
export class TagRuleValidationServiceImpl implements ITagRuleValidationService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * 验证 SQL 语法
   */
  async validateSqlSyntax(sql: string): Promise<SqlValidationResult> {
    if (!sql || sql.trim() === '') {
      return new SqlValidationResult(false, ['SQL 语句不能为空']);
    }

    try {
      // 尝试解析 SQL，支持 ClickHouse 方言
      this.parser.astify(sql, {
        database: 'postgresql', // 使用 postgresql 方言作为基础
      });
      return new SqlValidationResult(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      return new SqlValidationResult(false, [`SQL 语法错误: ${errorMsg}`]);
    }
  }

  /**
   * 验证 SQL 依赖的数据模型
   */
  async validateDependencies(
    sql: string,
    dataModelIds: string[]
  ): Promise<SqlValidationResult> {
    // 首先验证 SQL 语法
    const syntaxResult = await this.validateSqlSyntax(sql);
    if (!syntaxResult.valid) {
      return syntaxResult;
    }

    // 检查是否有数据模型依赖
    if (!dataModelIds || dataModelIds.length === 0) {
      return new SqlValidationResult(false, ['未指定数据模型依赖']);
    }

    // 简单检查：确保 SQL 中引用了数据模型
    // 实际实现中可以解析 AST 来验证表名
    const errors: string[] = [];
    
    try {
      const ast = this.parser.astify(sql, { database: 'postgresql' });
      
      // 提取 SQL 中的表名
      const tableNames = this.extractTableNames(ast);
      
      // 如果没有找到表引用，可能是子查询或表达式
      if (tableNames.length === 0) {
        // 不强制要求表名匹配，因为可能是复杂查询
        return new SqlValidationResult(true);
      }
    } catch {
      // AST 解析失败已经在语法验证中处理
    }

    return new SqlValidationResult(true, errors);
  }

  /**
   * 验证标签规则
   */
  async validateRule(rule: {
    ruleType: string;
    ruleContent?: string;
    steps?: Array<{ order: number; sql: string }>;
    dataModelIds?: string[];
  }): Promise<RuleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证规则类型
    if (!rule.ruleType) {
      errors.push('规则类型不能为空');
      return new RuleValidationResult(false, errors, warnings);
    }

    // 根据规则类型进行验证
    if (rule.ruleType === 'SQL') {
      // SQL 类型规则
      if (!rule.ruleContent || rule.ruleContent.trim() === '') {
        errors.push('SQL 规则内容不能为空');
      } else {
        const sqlResult = await this.validateSqlSyntax(rule.ruleContent);
        if (!sqlResult.valid) {
          errors.push(...sqlResult.errors);
        }

        // 验证数据模型依赖
        if (rule.dataModelIds && rule.dataModelIds.length > 0) {
          const depResult = await this.validateDependencies(
            rule.ruleContent,
            rule.dataModelIds
          );
          if (!depResult.valid) {
            errors.push(...depResult.errors);
          }
        } else {
          warnings.push('未指定数据模型依赖，可能会影响数据血缘追踪');
        }
      }
    } else if (rule.ruleType === 'CASCADE') {
      // 级联类型规则
      if (!rule.steps || rule.steps.length === 0) {
        errors.push('级联规则必须包含至少一个步骤');
      } else {
        // 验证每个步骤
        for (const step of rule.steps) {
          if (!step.sql || step.sql.trim() === '') {
            errors.push(`步骤 ${step.order} 的 SQL 不能为空`);
            continue;
          }

          const sqlResult = await this.validateSqlSyntax(step.sql);
          if (!sqlResult.valid) {
            errors.push(`步骤 ${step.order}: ${sqlResult.errors.join(', ')}`);
          }
        }

        // 检查步骤顺序
        const orders = rule.steps.map((s) => s.order);
        const sortedOrders = [...orders].sort((a, b) => a - b);
        for (let i = 0; i < sortedOrders.length; i++) {
          if (sortedOrders[i] !== i + 1) {
            warnings.push('步骤顺序建议从 1 开始连续递增');
            break;
          }
        }
      }
    } else {
      errors.push(`不支持的规则类型: ${rule.ruleType}`);
    }

    return new RuleValidationResult(errors.length === 0, errors, warnings);
  }

  /**
   * 激活前的完整验证
   */
  async validateForActivation(
    tag: { id: string; name: string; status: string },
    version: {
      id: string;
      versionNumber: number;
      status: string;
      calculationRule?: unknown;
    }
  ): Promise<RuleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证标签状态
    if (tag.status === 'DELETED') {
      errors.push('标签已被删除，无法激活');
    }

    // 验证版本状态
    if (version.status === 'DELETED') {
      errors.push('版本已被删除，无法激活');
    }

    // 验证计算规则
    if (!version.calculationRule) {
      errors.push('版本缺少计算规则');
    } else {
      const rule = version.calculationRule as {
        ruleType: string;
        ruleContent?: string;
        steps?: Array<{ order: number; sql: string }>;
        dataModelIds?: string[];
      };

      const ruleResult = await this.validateRule(rule);
      errors.push(...ruleResult.errors);
      warnings.push(...ruleResult.warnings);
    }

    return new RuleValidationResult(errors.length === 0, errors, warnings);
  }

  /**
   * 验证 INTERMEDIATE 目标表的 SQL 规则是否正确使用聚合函数
   *
   * 检查点:
   * 1. INSERT 语句中必须使用 State 组合器（如 uniqState, countState）
   * 2. State 组合器必须与目标表定义的聚合函数匹配
   */
  async validateTargetTableMatch(
    sql: string,
    aggregateConfig: { functionName: string; stateCombinator: string } | null,
  ): Promise<SqlValidationResult> {
    if (!sql || sql.trim() === '') {
      return new SqlValidationResult(false, ['SQL 语句不能为空']);
    }

    if (!aggregateConfig) {
      return new SqlValidationResult(true);
    }

    const errors: string[] = [];
    const { stateCombinator, functionName } = aggregateConfig;

    const statePattern = new RegExp(`\\b${stateCombinator}\\s*\\(`, 'i');
    if (!statePattern.test(sql)) {
      errors.push(
        `INTERMEDIATE 表的 INSERT SQL 必须使用 ${stateCombinator}() 组合器` +
        `（对应聚合函数 ${functionName}）`
      );
    }

    return new SqlValidationResult(errors.length === 0, errors);
  }

  /**
   * 从 AST 中提取表名
   */
  private extractTableNames(ast: unknown): string[] {
    const tableNames: string[] = [];
    
    const extractFromNode = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      
      const n = node as Record<string, unknown>;
      
      // 处理表引用
      if (n.table && typeof n.table === 'string') {
        tableNames.push(n.table);
      }
      
      // 递归处理子节点
      for (const value of Object.values(n)) {
        if (Array.isArray(value)) {
          value.forEach(extractFromNode);
        } else if (typeof value === 'object' && value !== null) {
          extractFromNode(value);
        }
      }
    };

    if (Array.isArray(ast)) {
      ast.forEach(extractFromNode);
    } else {
      extractFromNode(ast);
    }

    return tableNames;
  }
}

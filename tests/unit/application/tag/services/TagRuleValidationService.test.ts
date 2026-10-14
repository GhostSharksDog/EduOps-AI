import { describe, it, expect, beforeEach } from 'vitest';
import { TagRuleValidationServiceImpl } from '@/modules/tag/services/TagRuleValidationServiceImpl';

/**
 * TagRuleValidationService 单元测试
 * 
 * 测试覆盖：
 * - SQL 语法验证
 * - 数据模型依赖验证
 * - 标签规则验证（SQL/CASCADE）
 * - 激活前验证
 */
describe('TagRuleValidationService', () => {
  let service: TagRuleValidationServiceImpl;

  beforeEach(() => {
    service = new TagRuleValidationServiceImpl();
  });

  describe('validateSqlSyntax', () => {
    it('should return valid for correct SQL', async () => {
      const result = await service.validateSqlSyntax(
        'SELECT user_id, name FROM users WHERE id = 1'
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for syntax error', async () => {
      const result = await service.validateSqlSyntax('SELCT * FORM users');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('SQL 语法错误');
    });

    it('should return invalid for empty SQL', async () => {
      const result = await service.validateSqlSyntax('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SQL 语句不能为空');
    });

    it('should return invalid for whitespace-only SQL', async () => {
      const result = await service.validateSqlSyntax('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SQL 语句不能为空');
    });

    it('should handle complex SQL with JOIN', async () => {
      const sql = `
        SELECT u.user_id, o.order_id
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.status = 'active'
      `;
      const result = await service.validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });

    it('should handle SQL with subquery', async () => {
      const sql = `
        SELECT * FROM (
          SELECT user_id, COUNT(*) as cnt
          FROM orders
          GROUP BY user_id
        ) AS sub
        WHERE cnt > 10
      `;
      const result = await service.validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });

    it('should handle SQL with aggregate functions', async () => {
      const sql = `
        SELECT 
          user_id,
          COUNT(*) as order_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM orders
        GROUP BY user_id
        HAVING COUNT(*) > 5
      `;
      const result = await service.validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });

    it('should handle SQL with CASE WHEN', async () => {
      const sql = `
        SELECT 
          user_id,
          CASE 
            WHEN amount > 1000 THEN 'high'
            WHEN amount > 100 THEN 'medium'
            ELSE 'low'
          END as level
        FROM orders
      `;
      const result = await service.validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });

    it('should handle INSERT statement', async () => {
      const sql = 'INSERT INTO users (id, name) VALUES (1, \'test\')';
      const result = await service.validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });

    it('should handle UPDATE statement', async () => {
      const sql = 'UPDATE users SET name = \'test\' WHERE id = 1';
      const result = await service.validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });

    it('should handle DELETE statement', async () => {
      const sql = 'DELETE FROM users WHERE id = 1';
      const result = await service.validateSqlSyntax(sql);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDependencies', () => {
    it('should return valid when data models are provided', async () => {
      const sql = 'SELECT user_id FROM users';
      const dataModelIds = ['dm-users'];
      const result = await service.validateDependencies(sql, dataModelIds);
      expect(result.valid).toBe(true);
    });

    it('should return invalid when no data models specified', async () => {
      const sql = 'SELECT user_id FROM users';
      const result = await service.validateDependencies(sql, []);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('未指定数据模型依赖');
    });

    it('should return invalid when dataModelIds is null', async () => {
      const sql = 'SELECT user_id FROM users';
      const result = await service.validateDependencies(sql, null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('未指定数据模型依赖');
    });

    it('should propagate syntax errors', async () => {
      const sql = 'INVALID SQL';
      const result = await service.validateDependencies(sql, ['dm-1']);
      expect(result.valid).toBe(false);
    });

    it('should accept queries without explicit table references', async () => {
      const sql = 'SELECT 1 as value';
      const result = await service.validateDependencies(sql, ['dm-1']);
      // 简单查询可能没有表引用，但仍然应该通过
      expect(result.valid).toBe(true);
    });
  });

  describe('validateRule', () => {
    describe('SQL 类型规则', () => {
      it('should validate SQL type rule', async () => {
        const rule = {
          ruleType: 'SQL',
          ruleContent: 'SELECT user_id FROM users',
          dataModelIds: ['dm-1'],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject SQL rule without content', async () => {
        const rule = {
          ruleType: 'SQL',
          ruleContent: '',
          dataModelIds: ['dm-1'],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('SQL 规则内容不能为空');
      });

      it('should warn about missing data model dependencies', async () => {
        const rule = {
          ruleType: 'SQL',
          ruleContent: 'SELECT user_id FROM users',
          dataModelIds: [],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings).toContain('未指定数据模型依赖，可能会影响数据血缘追踪');
      });

      it('should not warn when data models are provided', async () => {
        const rule = {
          ruleType: 'SQL',
          ruleContent: 'SELECT user_id FROM users',
          dataModelIds: ['dm-1'],
        };
        const result = await service.validateRule(rule);
        const depWarnings = result.warnings.filter(w => 
          w.includes('数据模型依赖')
        );
        expect(depWarnings).toHaveLength(0);
      });

      it('should reject SQL rule with syntax errors', async () => {
        const rule = {
          ruleType: 'SQL',
          ruleContent: 'SELCT * FORM',
          dataModelIds: ['dm-1'],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('CASCADE 类型规则', () => {
      it('should validate CASCADE type rule', async () => {
        const rule = {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: 'SELECT user_id FROM users' },
            { order: 2, sql: 'SELECT user_id, value FROM temp_table' },
          ],
          dataModelIds: ['dm-1', 'dm-2'],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(true);
      });

      it('should reject CASCADE rule without steps', async () => {
        const rule = {
          ruleType: 'CASCADE',
          steps: [],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('级联规则必须包含至少一个步骤');
      });

      it('should reject CASCADE rule with undefined steps', async () => {
        const rule = {
          ruleType: 'CASCADE',
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('级联规则必须包含至少一个步骤');
      });

      it('should reject CASCADE rule with empty step SQL', async () => {
        const rule = {
          ruleType: 'CASCADE',
          steps: [{ order: 1, sql: '' }],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('步骤 1 的 SQL 不能为空');
      });

      it('should validate each step SQL', async () => {
        const rule = {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: 'SELECT user_id FROM users' },
            { order: 2, sql: 'INVALID SQL' },
            { order: 3, sql: 'SELECT value FROM table' },
          ],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('步骤 2'))).toBe(true);
      });

      it('should warn when step order is not consecutive', async () => {
        const rule = {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: 'SELECT 1' },
            { order: 3, sql: 'SELECT 2' },
            { order: 5, sql: 'SELECT 3' },
          ],
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('步骤顺序建议从 1 开始连续递增');
      });

      it('should not warn when step order is consecutive', async () => {
        const rule = {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: 'SELECT 1' },
            { order: 2, sql: 'SELECT 2' },
            { order: 3, sql: 'SELECT 3' },
          ],
        };
        const result = await service.validateRule(rule);
        const orderWarnings = result.warnings.filter(w => 
          w.includes('步骤顺序')
        );
        expect(orderWarnings).toHaveLength(0);
      });
    });

    describe('其他规则类型', () => {
      it('should reject unknown rule type', async () => {
        const rule = {
          ruleType: 'UNKNOWN',
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('不支持的规则类型: UNKNOWN');
      });

      it('should reject empty rule type', async () => {
        const rule = {
          ruleType: '',
        };
        const result = await service.validateRule(rule);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('规则类型不能为空');
      });

      it('should reject missing rule type', async () => {
        const rule = {};
        const result = await service.validateRule(rule as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('规则类型不能为空');
      });
    });
  });

  describe('validateForActivation', () => {
    const validTag = {
      id: 'tag-1',
      name: '测试标签',
      status: 'DRAFT',
    };

    const validVersion = {
      id: 'version-1',
      versionNumber: 1,
      status: 'ACTIVE',
      calculationRule: {
        ruleType: 'SQL',
        ruleContent: 'SELECT user_id FROM users',
        dataModelIds: ['dm-1'],
      },
    };

    it('should pass validation for valid tag and version', async () => {
      const result = await service.validateForActivation(validTag, validVersion);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject deleted tag', async () => {
      const result = await service.validateForActivation(
        { ...validTag, status: 'DELETED' },
        validVersion
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('标签已被删除，无法激活');
    });

    it('should reject deleted version', async () => {
      const result = await service.validateForActivation(validTag, {
        ...validVersion,
        status: 'DELETED',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('版本已被删除，无法激活');
    });

    it('should reject version without calculation rule', async () => {
      const result = await service.validateForActivation(validTag, {
        ...validVersion,
        calculationRule: null,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('版本缺少计算规则');
    });

    it('should reject version with undefined calculation rule', async () => {
      const result = await service.validateForActivation(validTag, {
        ...validVersion,
        calculationRule: undefined,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('版本缺少计算规则');
    });

    it('should accumulate multiple errors', async () => {
      const result = await service.validateForActivation(
        { ...validTag, status: 'DELETED' },
        { ...validVersion, status: 'DELETED', calculationRule: null }
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('标签已被删除，无法激活');
      expect(result.errors).toContain('版本已被删除，无法激活');
      expect(result.errors).toContain('版本缺少计算规则');
    });

    it('should propagate rule validation errors', async () => {
      const invalidRule = {
        ruleType: 'SQL',
        ruleContent: 'INVALID SQL',
      };
      const result = await service.validateForActivation(validTag, {
        ...validVersion,
        calculationRule: invalidRule,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('SQL'))).toBe(true);
    });

    it('should propagate rule validation warnings', async () => {
      const ruleWithWarning = {
        ruleType: 'SQL',
        ruleContent: 'SELECT user_id FROM users',
        dataModelIds: [], // 会产生警告
      };
      const result = await service.validateForActivation(validTag, {
        ...validVersion,
        calculationRule: ruleWithWarning,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should accept ACTIVE status tag', async () => {
      const result = await service.validateForActivation(
        { ...validTag, status: 'ACTIVE' },
        validVersion
      );
      expect(result.valid).toBe(true);
    });

    it('should accept DRAFT status tag', async () => {
      const result = await service.validateForActivation(
        { ...validTag, status: 'DRAFT' },
        validVersion
      );
      expect(result.valid).toBe(true);
    });

    it('should validate CASCADE rule in version', async () => {
      const cascadeVersion = {
        ...validVersion,
        calculationRule: {
          ruleType: 'CASCADE',
          steps: [
            { order: 1, sql: 'SELECT user_id FROM users' },
            { order: 2, sql: 'SELECT user_id, value FROM temp' },
          ],
        },
      };
      const result = await service.validateForActivation(validTag, cascadeVersion);
      expect(result.valid).toBe(true);
    });
  });
});

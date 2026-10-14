import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagRuleValidationServiceImpl } from '@/modules/tag/services/TagRuleValidationServiceImpl';

describe('TagRuleValidationServiceImpl', () => {
  let service: TagRuleValidationServiceImpl;

  beforeEach(() => {
    service = new TagRuleValidationServiceImpl();
  });

  it('validateSqlSyntax: 应正确解析有效的 SQL', async () => {
    const res = await service.validateSqlSyntax('SELECT 1');
    expect(res.valid).toBe(true);
  });

  it('validateSqlSyntax: 应正确识别无效的 SQL', async () => {
    const res = await service.validateSqlSyntax('SELECT FROM');
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('validateRule: SQL 类型规则应通过语法验证', async () => {
    const rule = {
      ruleType: 'SQL',
      ruleContent: 'SELECT 1',
      dataModelIds: ['dm1']
    } as any;
    const res = await service.validateRule(rule);
    expect(res.valid).toBe(true);
  });

  it('validateForActivation: 基本激活前置校验通过', async () => {
    const tag = { id: 't1', name: 'Tag1', status: 'ACTIVE' } as any;
    const version = {
      id: 'v1',
      versionNumber: 1,
      status: 'ACTIVE',
      calculationRule: { ruleType: 'SQL', ruleContent: 'SELECT 1' }
    } as any;
    const res = await service.validateForActivation(tag, version);
    expect(res.valid).toBe(true);
  });
});

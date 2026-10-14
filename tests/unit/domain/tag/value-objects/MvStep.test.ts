import { describe, it, expect } from 'vitest';
import { MvStep } from '@/modules/tag/domain/value-objects/MvStep';

describe('MvStep', () => {
  describe('constructor', () => {
    it('should create MvStep with all properties', () => {
      const step = new MvStep(
        1,
        'SELECT * FROM users',
        'target_table_1',
        'mv_step_1',
        'tag-1',
        1
      );

      expect(step.order).toBe(1);
      expect(step.sql).toBe('SELECT * FROM users');
      expect(step.stepResultTable).toBe('target_table_1');
      expect(step.mvName).toBe('mv_step_1');
      expect(step.tagId).toBe('tag-1');
      expect(step.version).toBe(1);
    });
  });

  describe('isLast', () => {
    it('should return true when order equals totalSteps', () => {
      const step = new MvStep(3, 'SQL', 'table', 'mv');
      expect(step.isLast(3)).toBe(true);
    });

    it('should return false when order is less than totalSteps', () => {
      const step = new MvStep(2, 'SQL', 'table', 'mv');
      expect(step.isLast(3)).toBe(false);
    });

    it('should return false when order is greater than totalSteps', () => {
      const step = new MvStep(5, 'SQL', 'table', 'mv');
      expect(step.isLast(3)).toBe(false);
    });

    it('should work with order 1', () => {
      const step = new MvStep(1, 'SQL', 'table', 'mv');
      expect(step.isLast(1)).toBe(true);
      expect(step.isLast(5)).toBe(false);
    });
  });

  describe('getVariableReplacements', () => {
    it('should return tagId and version from constructor', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv', 'abc123', 2);

      const replacements = step.getVariableReplacements();

      expect(replacements.get('{tagId}')).toBe('abc123');
      expect(replacements.get('{version}')).toBe('2');
    });

    it('should handle multi-digit version', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv', 'myTag', 123);

      const replacements = step.getVariableReplacements();

      expect(replacements.get('{tagId}')).toBe('myTag');
      expect(replacements.get('{version}')).toBe('123');
    });

    it('should return empty map when no tagId or version', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv');

      const replacements = step.getVariableReplacements();

      expect(replacements.size).toBe(0);
    });

    it('should return only tagId when version not provided', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv', 'xyz');

      const replacements = step.getVariableReplacements();

      expect(replacements.get('{tagId}')).toBe('xyz');
      expect(replacements.has('{version}')).toBe(false);
    });

  });

  describe('applyVariableReplacements', () => {
    it('should replace all variables in SQL', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv', 'test123', 3);
      const sql = 'SELECT * FROM table WHERE tag_id = {tagId} AND version = {version}';

      const result = step.applyVariableReplacements(sql);

      expect(result).toBe('SELECT * FROM table WHERE tag_id = test123 AND version = 3');
    });

    it('should replace multiple occurrences of same variable', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv', 'abc', 1);
      const sql = 'SELECT {tagId}, {tagId} FROM table_{tagId}';

      const result = step.applyVariableReplacements(sql);

      expect(result).toBe('SELECT abc, abc FROM table_abc');
    });

    it('should return original SQL when no replacements available', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv');
      const sql = 'SELECT * FROM table WHERE id = {tagId}';

      const result = step.applyVariableReplacements(sql);

      expect(result).toBe(sql);
    });

    it('should handle SQL without variables', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv', 'test', 1);
      const sql = 'SELECT * FROM users WHERE active = true';

      const result = step.applyVariableReplacements(sql);

      expect(result).toBe(sql);
    });

    it('should replace variables in complex SQL', () => {
      const step = new MvStep(1, 'SQL', 'target_table', 'mv', 'seg42', 10);
      const sql = `
        INSERT INTO result_{tagId}
        SELECT entity_id, '{version}' as version
        FROM source_table
        WHERE value IS NOT NULL
      `;

      const result = step.applyVariableReplacements(sql);

      expect(result).toContain('result_seg42');
      expect(result).toContain("'10' as version");
    });
  });
});

import { describe, it, expect } from 'vitest';
import { MvStep } from '@/modules/tag/domain/value-objects/MvStep';

describe('MvStep Value Object', () => {
  describe('isLast', () => {
    it('should return true for last step', () => {
      const step = new MvStep(3, 'SELECT 1', 'table', 'mv');
      expect(step.isLast(3)).toBe(true);
    });

    it('should return false for non-last step', () => {
      const step = new MvStep(1, 'SELECT 1', 'table', 'mv');
      expect(step.isLast(3)).toBe(false);
    });

    it('should return true for single step', () => {
      const step = new MvStep(1, 'SELECT 1', 'table', 'mv');
      expect(step.isLast(1)).toBe(true);
    });
  });

  describe('getVariableReplacements', () => {
    it('should return tagId and version from constructor', () => {
      const step = new MvStep(1, 'SELECT * FROM source', 'target_table', 'mv', 'abc123', 2);

      const replacements = step.getVariableReplacements();

      expect(replacements.get('{tagId}')).toBe('abc123');
      expect(replacements.get('{version}')).toBe('2');
    });

    it('should return empty map when no tagId or version', () => {
      const step = new MvStep(1, 'SELECT 1', 'target_table', 'mv');
      const replacements = step.getVariableReplacements();
      expect(replacements.size).toBe(0);
    });
  });

  describe('applyVariableReplacements', () => {
    it('should replace {tagId} in SQL', () => {
      const step = new MvStep(1, '', 'target_table', 'mv', 'mytag', 1);

      const sql = 'SELECT * FROM table WHERE tag_id = {tagId}';
      const result = step.applyVariableReplacements(sql);

      expect(result).toBe('SELECT * FROM table WHERE tag_id = mytag');
    });

    it('should replace {version} in SQL', () => {
      const step = new MvStep(1, '', 'target_table', 'mv', 'test', 3);

      const sql = 'SELECT version_{version} FROM table';
      const result = step.applyVariableReplacements(sql);

      expect(result).toBe('SELECT version_3 FROM table');
    });

    it('should replace multiple variables', () => {
      const step = new MvStep(1, '', 'target_table', 'mv', 'prod', 10);

      const sql = 'SELECT * FROM {tagId}_data WHERE version = {version}';
      const result = step.applyVariableReplacements(sql);

      expect(result).toBe('SELECT * FROM prod_data WHERE version = 10');
    });

    it('should replace multiple occurrences', () => {
      const step = new MvStep(1, '', 'target_table', 'mv', 'test', 1);

      const sql = 'SELECT {tagId}, {tagId}_name FROM table_{tagId}';
      const result = step.applyVariableReplacements(sql);

      expect(result).toBe('SELECT test, test_name FROM table_test');
    });

    it('should return original SQL when no replacements', () => {
      const step = new MvStep(1, '', 'target_table', 'mv');
      const sql = 'SELECT * FROM table';
      const result = step.applyVariableReplacements(sql);

      expect(result).toBe(sql);
    });
  });

  describe('constructor', () => {
    it('should store all properties', () => {
      const step = new MvStep(5, 'SELECT 1', 'target_table', 'mv_name', 'tag-1', 2);

      expect(step.order).toBe(5);
      expect(step.sql).toBe('SELECT 1');
      expect(step.stepResultTable).toBe('target_table');
      expect(step.mvName).toBe('mv_name');
      expect(step.tagId).toBe('tag-1');
      expect(step.version).toBe(2);
    });
  });
});
import { describe, it, expect, vi } from 'vitest';
import { getTablePagination } from '@/shared/ui/dashboard/pagination/getTablePagination';
import { PAGINATION_DEFAULTS } from '@/shared/ui/dashboard/pagination/defaults';

describe('Pagination Utilities', () => {
  describe('getTablePagination', () => {
    it('should generate pagination config with defaults', () => {
      const config = getTablePagination({
        current: 1,
        pageSize: 10,
        total: 100,
      });

      expect(config.current).toBe(1);
      expect(config.pageSize).toBe(10);
      expect(config.total).toBe(100);
      expect(config.showSizeChanger).toBe(true);
      expect(config.showQuickJumper).toBe(true);
      expect(config.pageSizeOptions).toEqual(['10', '20', '50', '100']);
    });

    it('should include onChange callback', () => {
      const onChange = vi.fn();
      const config = getTablePagination({
        current: 1,
        pageSize: 10,
        total: 100,
        onChange,
      });

      expect(config.onChange).toBe(onChange);
      expect(config.onShowSizeChange).toBe(onChange);
    });

    it('should allow overriding pageSizeOptions', () => {
      const config = getTablePagination({
        current: 1,
        pageSize: 10,
        total: 100,
        pageSizeOptions: ['5', '10', '25'],
      });

      expect(config.pageSizeOptions).toEqual(['5', '10', '25']);
    });

    it('should hide total when hideTotal is true', () => {
      const config = getTablePagination({
        current: 1,
        pageSize: 10,
        total: 100,
        hideTotal: true,
      });

      expect(config.showTotal).toBeUndefined();
    });

    it('should use default showTotal when not hidden', () => {
      const config = getTablePagination({
        current: 1,
        pageSize: 10,
        total: 100,
      });

      expect(config.showTotal).toBeDefined();
      expect(config.showTotal!(100, [1, 10])).toBe('共 100 条');
    });

    it('should allow custom showTotal', () => {
      const config = getTablePagination({
        current: 1,
        pageSize: 10,
        total: 100,
        showTotal: (total) => `Total: ${total}`,
      });

      expect(config.showTotal!(100, [1, 10])).toBe('Total: 100');
    });

    it('should work with no arguments (static pagination)', () => {
      const config = getTablePagination();

      expect(config.current).toBe(1);
      expect(config.pageSize).toBe(10);
      expect(config.showSizeChanger).toBe(true);
      expect(config.showQuickJumper).toBe(true);
      expect(config.pageSizeOptions).toEqual(['10', '20', '50', '100']);
    });

    it('should allow partial config with defaults', () => {
      const config = getTablePagination({ pageSize: 20 });

      expect(config.current).toBe(1);
      expect(config.pageSize).toBe(20);
    });
  });

  describe('PAGINATION_DEFAULTS', () => {
    it('should have expected default values', () => {
      expect(PAGINATION_DEFAULTS.pageSizeOptions).toEqual(['10', '20', '50', '100']);
      expect(PAGINATION_DEFAULTS.showSizeChanger).toBe(true);
      expect(PAGINATION_DEFAULTS.showQuickJumper).toBe(true);
      expect(PAGINATION_DEFAULTS.defaultPageSize).toBe(10);
    });

    it('showTotal should format correctly', () => {
      expect(PAGINATION_DEFAULTS.showTotal(50)).toBe('共 50 条');
      expect(PAGINATION_DEFAULTS.showTotal(1000)).toBe('共 1000 条');
    });
  });
});

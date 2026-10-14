/**
 * DataSourceOHSAdapterImpl Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataSourceOHSAdapterImpl } from '@/modules/data/services/datasource/DataSourceOHSAdapterImpl';

describe('DataSourceOHSAdapterImpl', () => {
  let adapter: DataSourceOHSAdapterImpl;

  beforeEach(() => {
    adapter = new DataSourceOHSAdapterImpl();
  });

  describe('adapter creation', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(DataSourceOHSAdapterImpl);
    });
  });
});

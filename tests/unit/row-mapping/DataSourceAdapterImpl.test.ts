import { describe, it, expect } from 'vitest';
import { DataSourceAdapterImpl } from '@/modules/data/repositories/DataSourceAdapterImpl';
import { MockFactory } from '../../helpers/mock-factory';

describe('DataSourceAdapterImpl', () => {
  const adapter = new DataSourceAdapterImpl();

  describe('fromPOToDataSource', () => {
    it('should convert DataSourcePO to DataSource entity', () => {
      const dsPO = MockFactory.createDataSourcePO({
        id: 'ds-1',
        name: 'Test DataSource',
      });

      const ds = adapter.fromPOToDataSource(dsPO as any);

      expect(ds.id).toBe('ds-1');
      expect(ds.name).toBe('Test DataSource');
    });
  });
});

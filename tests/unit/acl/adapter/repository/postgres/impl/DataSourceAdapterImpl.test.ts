import { describe, it, expect, beforeEach } from 'vitest';
import { DataSourceAdapterImpl } from '@/modules/data/repositories/DataSourceAdapterImpl';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import type { DataSourcePO } from '@/modules/data/repositories/persistence/data-source/DataSourcePO';
import { DataSourceStatus, DataSourceType } from '@/shared/enums/datasource/index';

describe('DataSourceAdapterImpl', () => {
  let adapter: DataSourceAdapterImpl;

  beforeEach(() => {
    adapter = new DataSourceAdapterImpl();
  });

  describe('fromPOToDataSource', () => {
    it('should convert PO to DataSource entity with all fields', () => {
      const po: DataSourcePO = {
        id: 'ds-123',
        name: 'Test DataSource',
        type: DataSourceType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        databaseName: 'test_db',
        username: 'testuser',
        password: 'testpass',
        status: DataSourceStatus.ACTIVE,
        ownedBy: 'user-123',
        description: 'Test description',
        isDeleted: false,
        feature: { key: 'value' },
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: new Date('2024-01-02T00:00:00.000Z'),
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: 'user-456',
        deletedBy: null
      };

      const entity = adapter.fromPOToDataSource(po);

      expect(entity.id).toBe('ds-123');
      expect(entity.name).toBe('Test DataSource');
        expect(entity.type).toBe(DataSourceType.POSTGRESQL);
      expect(entity.host).toBe('localhost');
      expect(entity.port).toBe(5432);
      expect(entity.databaseName).toBe('test_db');
      expect(entity.username).toBe('testuser');
      expect(entity.password).toBe('testpass');
      expect(entity.status).toBe(DataSourceStatus.ACTIVE);
      expect(entity.ownedBy).toBe('user-123');
      expect(entity.description).toBe('Test description');
      expect(entity.isDeleted).toBe(false);
      expect(entity.feature).toEqual({ key: 'value' });
    });

    it('should handle null description', () => {
      const po: DataSourcePO = {
        id: 'ds-123',
        name: 'Test DataSource',
        type: DataSourceType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        databaseName: 'test_db',
        username: 'testuser',
        password: 'testpass',
        status: DataSourceStatus.ACTIVE,
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: null,
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToDataSource(po);

      expect(entity.description).toBeUndefined();
    });

    it('should handle feature as object string', () => {
      const po: DataSourcePO = {
        id: 'ds-123',
        name: 'Test DataSource',
        type: DataSourceType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        databaseName: 'test_db',
        username: 'testuser',
        password: 'testpass',
        status: DataSourceStatus.ACTIVE,
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: '{"key": "value"}' as any,
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToDataSource(po);

      expect(entity.feature).toEqual({});
    });

    it('should handle null feature', () => {
      const po: DataSourcePO = {
        id: 'ds-123',
        name: 'Test DataSource',
        type: DataSourceType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        databaseName: 'test_db',
        username: 'testuser',
        password: 'testpass',
        status: DataSourceStatus.ACTIVE,
        ownedBy: 'user-123',
        description: null,
        isDeleted: false,
        feature: null,
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToDataSource(po);

      expect(entity.feature).toEqual({});
    });
  });

  describe('fromDataSourceToPO', () => {
    it('should convert DataSource entity to PO with all fields', () => {
      const entity = new DataSource(
        'ds-123',
        'Test DataSource',
        'user-123',
        new Date('2024-01-01T00:00:00.000Z'),
        'user-123',
        'Test description',
        DataSourceType.POSTGRESQL,
        'localhost',
        5432,
        'test_db',
        'testuser',
        'testpass',
        DataSourceStatus.ACTIVE,
        false,
        { key: 'value' }
      );

      const po = adapter.fromDataSourceToPO(entity);

      expect(po.id).toBe('ds-123');
      expect(po.name).toBe('Test DataSource');
      expect(po.type).toBe(DataSourceType.POSTGRESQL);
      expect(po.host).toBe('localhost');
      expect(po.port).toBe(5432);
      expect(po.databaseName).toBe('test_db');
      expect(po.username).toBe('testuser');
      expect(po.password).toBe('testpass');
      expect(po.status).toBe(DataSourceStatus.ACTIVE);
      expect(po.ownedBy).toBe('user-123');
      expect(po.description).toBe('Test description');
      expect(po.isDeleted).toBe(false);
      expect(po.feature).toEqual({ key: 'value' });
    });

    it('should handle optional fields as null when not provided', () => {
      const entity = new DataSource(
        'ds-123',
        'Test DataSource',
        'user-123',
        new Date('2024-01-01T00:00:00.000Z'),
        'user-123'
      );

      const po = adapter.fromDataSourceToPO(entity);

      expect(po.host).toBe('');
      expect(po.port).toBe(0);
      expect(po.databaseName).toBe('');
      expect(po.username).toBe('');
      expect(po.password).toBe('');
      expect(po.description).toBeNull();
      expect(po.feature).toBeNull();
    });

    it('should handle undefined password with nullish coalescing', () => {
      const entity = new DataSource(
        'ds-123',
        'Test DataSource',
        'user-123',
        new Date('2024-01-01T00:00:00.000Z'),
        'user-123'
      );

      const po = adapter.fromDataSourceToPO(entity);

      expect(po.password).toBe('');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through PO -> Entity -> PO conversion', () => {
      const originalPO: DataSourcePO = {
        id: 'ds-123',
        name: 'Test DataSource',
        type: DataSourceType.POSTGRESQL,
        host: 'localhost',
        port: 5432,
        databaseName: 'test_db',
        username: 'testuser',
        password: 'testpass',
        status: DataSourceStatus.ACTIVE,
        ownedBy: 'user-123',
        description: 'Test description',
        isDeleted: false,
        feature: { key: 'value' },
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        deleteTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deletedBy: null
      };

      const entity = adapter.fromPOToDataSource(originalPO);
      const convertedPO = adapter.fromDataSourceToPO(entity);

      expect(convertedPO.id).toBe(originalPO.id);
      expect(convertedPO.name).toBe(originalPO.name);
      expect(convertedPO.type).toBe(originalPO.type);
      expect(convertedPO.host).toBe(originalPO.host);
      expect(convertedPO.port).toBe(originalPO.port);
    });
  });
});

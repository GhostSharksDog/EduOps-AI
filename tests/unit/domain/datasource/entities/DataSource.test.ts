import { describe, it, expect, beforeEach } from 'vitest';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import { DataSourceStatus, DataSourceType } from '@/shared/enums/datasource/index';

describe('DataSource Entity', () => {
  let dataSource: DataSource;

  beforeEach(() => {
    dataSource = new DataSource(
      'ds-001',
      'Test DataSource',
      'user-001',
      new Date(),
      'user-001'
    );
  });

  describe('constructor', () => {
    it('should create a DataSource with required fields', () => {
      expect(dataSource.id).toBe('ds-001');
      expect(dataSource.name).toBe('Test DataSource');
      expect(dataSource.ownedBy).toBe('user-001');
      expect(dataSource.createdBy).toBe('user-001');
    });

    it('should allow optional description', () => {
      const ds = new DataSource(
        'ds-002',
        'Test DS',
        'user-001',
        new Date(),
        'user-001',
        'Test description'
      );
      expect(ds.description).toBe('Test description');
    });

    it('should allow optional connection info', () => {
      const ds = new DataSource(
        'ds-002',
        'Test DS',
        'user-001',
        new Date(),
        'user-001',
        undefined,
        DataSourceType.POSTGRESQL,
        'localhost',
        5432,
        'testdb',
        'admin',
        'password',
        DataSourceStatus.ACTIVE
      );

      expect(ds.type).toBe(DataSourceType.POSTGRESQL);
      expect(ds.host).toBe('localhost');
      expect(ds.port).toBe(5432);
      expect(ds.databaseName).toBe('testdb');
      expect(ds.username).toBe('admin');
      expect(ds.status).toBe(DataSourceStatus.ACTIVE);
    });

    it('should default isDeleted to false', () => {
      expect(dataSource.isDeleted).toBe(false);
    });
  });

  describe('updateInfo', () => {
    it('should update name', () => {
      dataSource.updateInfo('Updated Name');

      expect(dataSource.name).toBe('Updated Name');
      expect(dataSource.updateTime).toBeDefined();
    });

    it('should update description if provided', () => {
      dataSource.updateInfo('Updated Name', 'Updated description');

      expect(dataSource.description).toBe('Updated description');
    });

    it('should update feature if provided', () => {
      const feature = { customProp: 'value' };

      dataSource.updateInfo('Updated Name', undefined, feature);

      expect(dataSource.feature).toBe(feature);
    });
  });

  describe('updateConnectionInfo', () => {
    it('should update connection info', () => {
      dataSource.updateConnectionInfo('192.168.1.1', 3306, 'mydb', 'root');

      expect(dataSource.host).toBe('192.168.1.1');
      expect(dataSource.port).toBe(3306);
      expect(dataSource.databaseName).toBe('mydb');
      expect(dataSource.username).toBe('root');
      expect(dataSource.updateTime).toBeDefined();
    });
  });

  describe('enable', () => {
    it('should change status to ACTIVE', () => {
      dataSource = new DataSource(
        'ds-001',
        'Test DS',
        'user-001',
        new Date(),
        'user-001',
        undefined,
        DataSourceType.POSTGRESQL,
        'localhost',
        5432,
        'testdb',
        'admin',
        'password',
        DataSourceStatus.DISABLED
      );

      dataSource.enable();

      expect(dataSource.status).toBe(DataSourceStatus.ACTIVE);
      expect(dataSource.updateTime).toBeDefined();
    });

    it('should not update time if already ACTIVE', () => {
      dataSource = new DataSource(
        'ds-001',
        'Test DS',
        'user-001',
        new Date(),
        'user-001',
        undefined,
        DataSourceType.POSTGRESQL,
        'localhost',
        5432,
        'testdb',
        'admin',
        'password',
        DataSourceStatus.ACTIVE
      );
      const originalUpdateTime = dataSource.updateTime;

      dataSource.enable();

      expect(dataSource.updateTime).toBe(originalUpdateTime);
    });
  });

  describe('disable', () => {
    it('should change status to DISABLED', () => {
      dataSource = new DataSource(
        'ds-001',
        'Test DS',
        'user-001',
        new Date(),
        'user-001',
        undefined,
        DataSourceType.POSTGRESQL,
        'localhost',
        5432,
        'testdb',
        'admin',
        'password',
        DataSourceStatus.ACTIVE
      );

      dataSource.disable();

      expect(dataSource.status).toBe(DataSourceStatus.DISABLED);
      expect(dataSource.updateTime).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should soft delete the data source', () => {
      dataSource.delete('user-002');

      expect(dataSource.isDeleted).toBe(true);
      expect(dataSource.deletedBy).toBe('user-002');
      expect(dataSource.deleteTime).toBeDefined();
      expect(dataSource.updateTime).toBeDefined();
    });

    it('should not delete if already deleted', () => {
      dataSource.delete('user-002');
      const firstDeleteTime = dataSource.deleteTime;

      dataSource.delete('user-003');

      expect(dataSource.deletedBy).toBe('user-002');
      expect(dataSource.deleteTime).toBe(firstDeleteTime);
    });
  });

  describe('restore', () => {
    it('should restore a deleted data source', () => {
      dataSource.delete('user-002');
      dataSource.restore();

      expect(dataSource.isDeleted).toBe(false);
      expect(dataSource.deletedBy).toBeUndefined();
      expect(dataSource.deleteTime).toBeUndefined();
      expect(dataSource.updateTime).toBeDefined();
    });

    it('should not restore if not deleted', () => {
      const originalUpdateTime = dataSource.updateTime;

      dataSource.restore();

      expect(dataSource.updateTime).toBe(originalUpdateTime);
    });
  });

  describe('updateFeature', () => {
    it('should update the feature', () => {
      const feature = { customProp: 'value' };

      dataSource.updateFeature(feature);

      expect(dataSource.feature).toBe(feature);
      expect(dataSource.updateTime).toBeDefined();
    });
  });
});

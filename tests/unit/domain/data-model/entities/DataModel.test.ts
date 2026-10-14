import { describe, it, expect, beforeEach } from 'vitest';
import { DataModel } from '@/modules/data/domain/data-model/entities/DataModel';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import { DataModelStatus } from '@/shared/enums/index';
import { ModelColumn } from '@/modules/data/domain/data-model/entities/ModelColumn';
import { DataType } from '@/shared/enums/index';

describe('DataModel Entity', () => {
  let dataModel: DataModel;
  let dataSource: DataSource;

  beforeEach(() => {
    dataSource = new DataSource(
      'ds-001',
      'Test DataSource',
      'user-001',
      new Date(),
      'user-001'
    );

    dataModel = new DataModel(
      'model-001',
      'Test Model',
      DataModelStatus.ACTIVE,
      dataSource,
      'user-001',
      new Date(),
      'user-001'
    );
  });

  function createColumn(id: string, name: string, dataType?: DataType): ModelColumn {
    return new ModelColumn(
      id,
      'model-001',
      name,
      'user-001',
      new Date(),
      'user-001',
      undefined,
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dataType
    );
  }

  describe('constructor', () => {
    it('should create a DataModel with required fields', () => {
      expect(dataModel.id).toBe('model-001');
      expect(dataModel.name).toBe('Test Model');
      expect(dataModel.status).toBe(DataModelStatus.ACTIVE);
      expect(dataModel.datasource).toBe(dataSource);
      expect(dataModel.ownedBy).toBe('user-001');
    });

    it('should allow optional description', () => {
      const model = new DataModel(
        'model-002',
        'Test Model',
        DataModelStatus.ACTIVE,
        dataSource,
        'user-001',
        new Date(),
        'user-001',
        'Test description'
      );
      expect(model.description).toBe('Test description');
    });
    it('should default columns to empty array', () => {
      expect(dataModel.columns).toEqual([]);
    });
    it('should default isDeleted to false', () => {
      expect(dataModel.isDeleted).toBe(false);
    });
  });
  describe('activate', () => {
    it('should change status to ACTIVE', () => {
      dataModel = new DataModel(
        'model-001',
        'Test Model',
        DataModelStatus.INACTIVE,
        dataSource,
        'user-001',
        new Date(),
        'user-001'
      );
      dataModel.activate();
      expect(dataModel.status).toBe(DataModelStatus.ACTIVE);
      expect(dataModel.updateTime).toBeDefined();
    });
  });
  describe('deactivate', () => {
    it('should change status to INACTIVE', () => {
      dataModel.deactivate();
      expect(dataModel.status).toBe(DataModelStatus.INACTIVE);
      expect(dataModel.updateTime).toBeDefined();
    });
  });
  describe('updateInfo', () => {
    it('should update name', () => {
      dataModel.updateInfo('Updated Name');
      expect(dataModel.name).toBe('Updated Name');
      expect(dataModel.updateTime).toBeDefined();
    });
    it('should update description if provided', () => {
      dataModel.updateInfo('Updated Name', 'Updated description');
      expect(dataModel.description).toBe('Updated description');
    });
    it('should update tableName if provided', () => {
      dataModel.updateInfo('Updated Name', undefined, 'updated_table');
      expect(dataModel.tableName).toBe('updated_table');
    });
  });
  describe('addColumn', () => {
    it('should add a column to the model', () => {
      const column = createColumn('col-001', 'test_column', DataType.STRING);
      dataModel.addColumn(column);
      expect(dataModel.columns.length).toBe(1);
      expect(dataModel.columns[0]).toBe(column);
      expect(dataModel.updateTime).toBeDefined();
    });
  });
  describe('updateColumn', () => {
    it('should update an existing column', () => {
      const column = createColumn('col-001', 'test_column', DataType.STRING);
      dataModel.addColumn(column);
      const updatedColumn = createColumn('col-001', 'updated_column', DataType.NUMBER);
      dataModel.updateColumn(updatedColumn);
      expect(dataModel.columns[0].name).toBe('updated_column');
      expect(dataModel.columns[0].dataType).toBe(DataType.NUMBER);
    });
    it('should not update if column does not exist', () => {
      const column = createColumn('col-999', 'non_existent', DataType.STRING);
      const originalLength = dataModel.columns.length;
      dataModel.updateColumn(column);
      expect(dataModel.columns.length).toBe(originalLength);
    });
  });
  describe('removeColumn', () => {
    it('should remove a column by id', () => {
      const column = createColumn('col-001', 'test_column', DataType.STRING);
      dataModel.addColumn(column);
      dataModel.removeColumn('col-001');
      expect(dataModel.columns.length).toBe(0);
      expect(dataModel.updateTime).toBeDefined();
    });
  });
  describe('delete', () => {
    it('should soft delete the model', () => {
      dataModel.delete('user-002');
      expect(dataModel.isDeleted).toBe(true);
      expect(dataModel.deletedBy).toBe('user-002');
      expect(dataModel.deleteTime).toBeDefined();
      expect(dataModel.updateTime).toBeDefined();
    });
    it('should not delete if already deleted', () => {
      dataModel.delete('user-002');
      const firstDeleteTime = dataModel.deleteTime;
      dataModel.delete('user-003');
      expect(dataModel.deletedBy).toBe('user-002');
      expect(dataModel.deleteTime).toBe(firstDeleteTime);
    });
  });
  describe('updateFeature', () => {
    it('should update the feature', () => {
      const feature = { customProp: 'value' };
      dataModel.updateFeature(feature);
      expect(dataModel.feature).toBe(feature);
      expect(dataModel.updateTime).toBeDefined();
    });
  });
});

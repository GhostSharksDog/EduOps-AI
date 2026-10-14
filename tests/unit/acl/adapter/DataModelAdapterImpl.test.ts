import { describe, it, expect, beforeEach } from 'vitest';
import { DataModelAdapterImpl, ModelColumnAdapterImpl } from '@/modules/data/repositories/DataModelAdapterImpl';
import type { DataModelPO } from '@/modules/data/repositories/persistence/data-model/DataModelPO';
import type { ModelColumnPO } from '@/modules/data/repositories/persistence/data-model/ModelColumnPO';
import { DataModel } from '@/modules/data/domain/data-model/entities/DataModel';
import { DataType } from '@/shared/enums/index';
import { ModelColumn } from '@/modules/data/domain/data-model/entities/ModelColumn';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';

describe('DataModelAdapterImpl', () => {
  let adapter: DataModelAdapterImpl;
  let columnAdapter: ModelColumnAdapterImpl;

  beforeEach(() => {
    columnAdapter = new ModelColumnAdapterImpl();
    adapter = new DataModelAdapterImpl(columnAdapter);
  });

  describe('fromDataModelPOToDataModel', () => {
    it('should convert PO to entity correctly', () => {
      const po: DataModelPO = {
        id: 'model-123',
        name: 'Test Model',
        tableName: 'test_table',
        datasourceId: 'ds-123',
        status: 'INACTIVE',
        isDeleted: false,
        description: 'Test description',
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01T00:00:00.000Z'),
        updateTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deleteTime: null,
        deletedBy: null,
        feature: null
      };

      const columnPOs: ModelColumnPO[] = [];

      const entity = adapter.fromDataModelPOToDataModel(po, columnPOs);

      expect(entity.id).toBe('model-123');
      expect(entity.name).toBe('Test Model');
      expect(entity.tableName).toBe('test_table');
      expect(entity.datasource.id).toBe('ds-123');
      expect(entity.status).toBe('INACTIVE');
      expect(entity.description).toBe('Test description');
      expect(entity.ownedBy).toBe('user-123');
    });

    it('should include columns in converted entity', () => {
      const po: DataModelPO = {
        id: 'model-123',
        name: 'Test Model',
        tableName: 'test_table',
        datasourceId: 'ds-123',
        status: 'ACTIVE',
        isDeleted: false,
        description: null,
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01'),
        updateTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deleteTime: null,
        deletedBy: null,
        feature: null
      };

      const columnPOs: ModelColumnPO[] = [
        {
          id: 'col-1',
          modelId: 'model-123',
          name: 'id',
          displayName: 'ID',
          dataType: 'STRING',
          length: null,
          precision: null,
          scale: null,
          isNullable: false,
          defaultValue: null,
          orderIndex: 0,
          isPrimaryKey: true,
          isDeleted: false,
          description: null,
          ownedBy: 'user-123',
          createTime: new Date('2024-01-01'),
          updateTime: null,
          createdBy: 'user-123',
          updatedBy: null,
          deleteTime: null,
          deletedBy: null,
          feature: null
        }
      ];

      const entity = adapter.fromDataModelPOToDataModel(po, columnPOs);

      expect(entity.columns).toHaveLength(1);
      expect(entity.columns[0].name).toBe('id');
      expect(entity.columns[0].isPrimaryKey).toBe(true);
    });
  });

  describe('fromDataModelToDataModelPO', () => {
    it('should convert entity to PO correctly', () => {
      const datasource = new DataSource(
        'ds-123',
        'Test Datasource',
        'user-123',
        new Date('2024-01-01'),
        'user-123'
      );

      const entity = new DataModel(
        'model-123',
        'Test Model',
        'ACTIVE' as any, // status
        datasource,
        'user-123',
        new Date('2024-01-01T00:00:00.000Z'),
        'user-123'
      );
      entity.tableName = 'test_table';
      entity.description = 'Test description';

      const po = adapter.fromDataModelToDataModelPO(entity);

      expect(po.id).toBe('model-123');
      expect(po.name).toBe('Test Model');
      expect(po.tableName).toBe('test_table');
      expect(po.datasourceId).toBe('ds-123');
      expect(po.status).toBe('ACTIVE');
    });

    it('should handle entities without tableName', () => {
      const datasource = new DataSource(
        'ds-123',
        'Test Datasource',
        'user-123',
        new Date(),
        'user-123'
      );

      const entity = new DataModel(
        'model-1',
        'No Table Model',
        'INACTIVE' as any, // status
        datasource,
        'user-123',
        new Date(),
        'user-123'
      );

      const po = adapter.fromDataModelToDataModelPO(entity);

      expect(po.id).toBe('model-1');
    });
  });

  describe('fromDataModelPOListToDataModelList', () => {
    it('should convert list of POs to entities', () => {
      const pos: DataModelPO[] = [
        {
          id: 'model-1',
          name: 'Model 1',
          tableName: 'table1',
          datasourceId: 'ds-123',
          status: 'ACTIVE',
          isDeleted: false,
          description: null,
          ownedBy: 'user-123',
          createTime: new Date('2024-01-01'),
          updateTime: null,
          createdBy: 'user-123',
          updatedBy: null,
          deleteTime: null,
          deletedBy: null,
          feature: null
        },
        {
          id: 'model-2',
          name: 'Model 2',
          tableName: 'table2',
          datasourceId: 'ds-123',
          status: 'INACTIVE',
          isDeleted: false,
          description: null,
          ownedBy: 'user-123',
          createTime: new Date('2024-01-01'),
          updateTime: null,
          createdBy: 'user-123',
          updatedBy: null,
          deleteTime: null,
          deletedBy: null,
          feature: null
        }
      ];

      const columnPOs: ModelColumnPO[] = [];

      const entities = adapter.fromDataModelPOListToDataModelList(pos, columnPOs);

      expect(entities).toHaveLength(2);
      expect(entities[0].name).toBe('Model 1');
      expect(entities[1].name).toBe('Model 2');
    });

    it('should return empty array for empty input', () => {
      const entities = adapter.fromDataModelPOListToDataModelList([], []);
      expect(entities).toHaveLength(0);
    });
  });
});

describe('ModelColumnAdapterImpl', () => {
  let adapter: ModelColumnAdapterImpl;

  beforeEach(() => {
    adapter = new ModelColumnAdapterImpl();
  });

  describe('fromModelColumnPOToModelColumn', () => {
    it('should convert column PO to entity correctly', () => {
      const po: ModelColumnPO = {
        id: 'col-123',
        modelId: 'model-123',
        name: 'email',
        displayName: 'Email Address',
        dataType: 'STRING',
        length: 255,
        precision: null,
        scale: null,
        isNullable: true,
        defaultValue: null,
        orderIndex: 1,
        isPrimaryKey: false,
        isDeleted: false,
        description: 'User email address',
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01'),
        updateTime: null,
        createdBy: 'user-123',
        updatedBy: null,
        deleteTime: null,
        deletedBy: null,
        feature: null
      };

      const entity = adapter.fromModelColumnPOToModelColumn(po);

      expect(entity.id).toBe('col-123');
      expect(entity.modelId).toBe('model-123');
      expect(entity.name).toBe('email');
      expect(entity.displayName).toBe('Email Address');
      expect(entity.dataType).toBe('STRING');
      expect(entity.length).toBe(255);
      expect(entity.isNullable).toBe(true);
      expect(entity.isPrimaryKey).toBe(false);
    });
  });

  describe('fromModelColumnToModelColumnPO', () => {
    it('should convert entity to column PO correctly', () => {
      const entity = new ModelColumn(
        'col-123',
        'model-123',
        'email',
        'user-123',
        new Date('2024-01-01T00:00:00.000Z'),
        'user-123'
      );
      entity.displayName = 'Email Address';
      entity.dataType = DataType.STRING;
      entity.length = 255;
      entity.isNullable = true;
      entity.orderIndex = 1;
      entity.isPrimaryKey = false;

      const po = adapter.fromModelColumnToModelColumnPO(entity);

      expect(po.id).toBe('col-123');
      expect(po.modelId).toBe('model-123');
      expect(po.name).toBe('email');
      expect(po.displayName).toBe('Email Address');
      expect(po.dataType).toBe('STRING');
      expect(po.length).toBe(255);
      expect(po.isNullable).toBe(true);
      expect(po.isPrimaryKey).toBe(false);
    });
  });

  describe('fromModelColumnPOListToModelColumnList', () => {
    it('should convert list of column POs to entities', () => {
      const pos: ModelColumnPO[] = [
        {
          id: 'col-1',
          modelId: 'model-123',
          name: 'id',
          displayName: 'ID',
          dataType: 'STRING',
          length: null,
          precision: null,
          scale: null,
          isNullable: false,
          defaultValue: null,
          orderIndex: 0,
          isPrimaryKey: true,
          isDeleted: false,
          description: null,
          ownedBy: 'user-123',
          createTime: new Date('2024-01-01'),
          updateTime: null,
          createdBy: 'user-123',
          updatedBy: null,
          deleteTime: null,
          deletedBy: null,
          feature: null
        },
        {
          id: 'col-2',
          modelId: 'model-123',
          name: 'name',
          displayName: 'Name',
          dataType: 'STRING',
          length: 100,
          precision: null,
          scale: null,
          isNullable: true,
          defaultValue: null,
          orderIndex: 1,
          isPrimaryKey: false,
          isDeleted: false,
          description: null,
          ownedBy: 'user-123',
          createTime: new Date('2024-01-01'),
          updateTime: null,
          createdBy: 'user-123',
          updatedBy: null,
          deleteTime: null,
          deletedBy: null,
          feature: null
        }
      ];

      const entities = adapter.fromModelColumnPOListToModelColumnList(pos);

      expect(entities).toHaveLength(2);
      expect(entities[0].name).toBe('id');
      expect(entities[0].isPrimaryKey).toBe(true);
      expect(entities[1].name).toBe('name');
      expect(entities[1].isPrimaryKey).toBe(false);
    });
  });
});

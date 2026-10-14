import { describe, it, expect, beforeEach } from 'vitest';
import { DataModelFactoryImpl } from '@/modules/data/domain/data-model/factories/DataModelFactoryImpl';
import { CreateDataModelCommand, UpdateDataModelCommand, ModelColumnCreateCommand } from '@/modules/data/contracts/data-model/commands/index';
import { ColumnOperation, ModelColumnUpdateCommand } from '@/modules/data/contracts/data-model/commands/ModelColumnUpdateCommand';
import { DataModel } from '@/modules/data/domain/data-model/entities/DataModel';
import { DataModelStatus } from '@/shared/enums/index';
import { DataType } from '@/shared/enums/data-models/DataType';

describe('DataModelFactoryImpl', () => {
  let factory: DataModelFactoryImpl;

  beforeEach(() => {
    factory = new DataModelFactoryImpl();
  });

  describe('createDataModel', () => {
    it('should create a DataModel with all fields from command', () => {
      const command = new CreateDataModelCommand(
        'User Model',
        'user-001',
        'ds-001',
        'User data model',
        'users',
        DataModelStatus.ACTIVE,
        [
          new ModelColumnCreateCommand(
            'user_id',
            'user-001',
            'User ID',
            DataType.STRING,
            255,
            null,
            null,
            false,
            undefined,
            undefined,
            0,
            true
          )
        ],
        { customProp: 'value' }
      );

      const dataModel = factory.createDataModel(command);

      expect(dataModel.name).toBe('User Model');
      expect(dataModel.description).toBe('User data model');
      expect(dataModel.tableName).toBe('users');
      expect(dataModel.status).toBe(DataModelStatus.ACTIVE);
      expect(dataModel.feature).toEqual({ customProp: 'value' });
      expect(dataModel.isDeleted).toBe(false);
      expect(dataModel.columns.length).toBe(1);
    });

    it('should create DataModel with empty columns if not provided', () => {
      const command = new CreateDataModelCommand(
        'Empty Model',
        'user-001',
        'ds-001'
      );

      const dataModel = factory.createDataModel(command);

      expect(dataModel.name).toBe('Empty Model');
      expect(dataModel.columns).toEqual([]);
    });

    it('should generate UUID for dataModel id', () => {
      const command = new CreateDataModelCommand(
        'Test Model',
        'user-001',
        'ds-001'
      );

      const dataModel = factory.createDataModel(command);

      expect(dataModel.id).toBeDefined();
      expect(typeof dataModel.id).toBe('string');
      expect(dataModel.id.length).toBeGreaterThan(0);
    });
  });

  describe('updateDataModel', () => {
    let existingModel: DataModel;

    beforeEach(() => {
      existingModel = factory.createDataModel(new CreateDataModelCommand(
        'Original Model',
        'user-001',
        'ds-001',
        'Original description',
        'original_table',
        DataModelStatus.ACTIVE
      ));
    });

    it('should update name and description', () => {
      const command = new UpdateDataModelCommand(
        existingModel.id,
        'Updated Model',
        'Updated description',
        undefined,
        undefined,
        undefined,
        undefined,
        'user-002'
      );

      const updatedModel = factory.updateDataModel(existingModel, command);

      expect(updatedModel.name).toBe('Updated Model');
      expect(updatedModel.description).toBe('Updated description');
      expect(updatedModel.updatedBy).toBe('user-002');
      expect(updatedModel.updateTime).toBeDefined();
    });

    it('should update tableName', () => {
      const command = new UpdateDataModelCommand(
        existingModel.id,
        undefined,
        undefined,
        'updated_table',
        undefined,
        undefined,
        undefined,
        'user-002'
      );

      const updatedModel = factory.updateDataModel(existingModel, command);

      expect(updatedModel.tableName).toBe('updated_table');
    });

    it('should update feature', () => {
      const feature = { newProp: 'new_value' };
      const command = new UpdateDataModelCommand(
        existingModel.id,
        undefined,
        undefined,
        undefined,
        undefined,
        feature,
        undefined,
        'user-002'
      );

      const updatedModel = factory.updateDataModel(existingModel, command);

      expect(updatedModel.feature).toEqual(feature);
    });

    it('should not modify fields not in command', () => {
      const originalName = existingModel.name;
      const originalDescription = existingModel.description;

      const command = new UpdateDataModelCommand(
        existingModel.id,
        undefined,
        undefined,
        'new_table',
        undefined,
        undefined,
        undefined,
        'user-002'
      );

      const updatedModel = factory.updateDataModel(existingModel, command);

      expect(updatedModel.name).toBe(originalName);
      expect(updatedModel.description).toBe(originalDescription);
    });
  });

  describe('createOrUpdateColumns', () => {
    let existingModel: DataModel;

    beforeEach(() => {
      existingModel = factory.createDataModel(new CreateDataModelCommand(
        'Test Model',
        'user-001',
        'ds-001',
        '',
        '',
        DataModelStatus.ACTIVE,
        [
          new ModelColumnCreateCommand(
            'existing_col',
            'user-001',
            'Existing Column',
            DataType.STRING,
            null,
            null,
            null,
            true,
            undefined,
            undefined,
            0,
            false
          )
        ]
      ));
    });

    it('should create new column with CREATE operation', () => {
      const commands: ModelColumnUpdateCommand[] = [
        new ModelColumnUpdateCommand(
          ColumnOperation.CREATE,
          undefined,
          'user-002',
          undefined,
          'new_col',
          'New Column',
          DataType.NUMBER,
          undefined,
          undefined,
          undefined,
          false,
          undefined,
          undefined,
          1,
          false
        )
      ];

      const columns = factory.createOrUpdateColumns(existingModel, commands);

      expect(columns.length).toBe(1);
      expect(columns[0].name).toBe('new_col');
      expect(columns[0].dataType).toBe(DataType.NUMBER);
      expect(columns[0].createdBy).toBe('user-002');
    });

    it('should update existing column with UPDATE operation', () => {
      const existingColumnId = existingModel.columns[0].id;
      const commands: ModelColumnUpdateCommand[] = [
        new ModelColumnUpdateCommand(
          ColumnOperation.UPDATE,
          existingColumnId,
          'user-002',
          undefined,
          'updated_col',
          'Updated Column',
          DataType.STRING,
          undefined,
          undefined,
          undefined,
          false
        )
      ];

      const columns = factory.createOrUpdateColumns(existingModel, commands);

      expect(columns.length).toBe(1);
      expect(columns[0].name).toBe('updated_col');
      expect(columns[0].updatedBy).toBe('user-002');
    });

    it('should silently skip UPDATE for non-existent column (defensive handling)', () => {
      const commands: ModelColumnUpdateCommand[] = [
        new ModelColumnUpdateCommand(
          ColumnOperation.UPDATE,
          'non-existent-id',
          'user-002',
          undefined,
          'updated_col'
        )
      ];

      const columns = factory.createOrUpdateColumns(existingModel, commands);

      expect(columns).toHaveLength(0);
    });

    it('should silently skip DELETE for non-existent column', () => {
      const commands: ModelColumnUpdateCommand[] = [
        new ModelColumnUpdateCommand(
          ColumnOperation.DELETE,
          'non-existent-id',
          'user-002'
        )
      ];

      const columns = factory.createOrUpdateColumns(existingModel, commands);

      expect(columns).toHaveLength(0);
    });

    it('should soft delete column with DELETE operation', () => {
      const existingColumnId = existingModel.columns[0].id;
      const commands: ModelColumnUpdateCommand[] = [
        new ModelColumnUpdateCommand(
          ColumnOperation.DELETE,
          existingColumnId,
          'user-002'
        )
      ];

      const columns = factory.createOrUpdateColumns(existingModel, commands);

      expect(columns.length).toBe(1);
      expect(columns[0].isDeleted).toBe(true);
      expect(columns[0].deletedBy).toBe('user-002');
      expect(columns[0].deleteTime).toBeDefined();
    });

    it('should update dataModel updateTime', () => {
      const commands: ModelColumnUpdateCommand[] = [
        new ModelColumnUpdateCommand(
          ColumnOperation.CREATE,
          undefined,
          'user-002',
          undefined,
          'new_col',
          'New Column',
          DataType.STRING,
          undefined,
          undefined,
          undefined,
          true,
          undefined,
          undefined,
          1,
          false
        )
      ];

      factory.createOrUpdateColumns(existingModel, commands);

      expect(existingModel.updateTime).toBeDefined();
    });
  });
});

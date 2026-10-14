import { describe, it, expect, beforeEach } from 'vitest';
import { ModelColumn } from '@/modules/data/domain/data-model/entities/ModelColumn';
import { DataType } from '@/shared/enums/index';

describe('ModelColumn Entity', () => {
  let modelColumn: ModelColumn;

  beforeEach(() => {
    modelColumn = new ModelColumn(
      'column-001',
      'model-001',
      'user_id',
      'user-001',
      new Date('2024-01-01'),
      'user-001',
      undefined,
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      DataType.STRING,
      255,
      undefined,
      undefined,
      false,
      undefined,
      0,
      false
    );
  });

  describe('constructor', () => {
    it('should create a ModelColumn with required fields', () => {
      expect(modelColumn.id).toBe('column-001');
      expect(modelColumn.modelId).toBe('model-001');
      expect(modelColumn.name).toBe('user_id');
      expect(modelColumn.ownedBy).toBe('user-001');
      expect(modelColumn.dataType).toBe(DataType.STRING);
      expect(modelColumn.length).toBe(255);
      expect(modelColumn.isNullable).toBe(false);
      expect(modelColumn.orderIndex).toBe(0);
      expect(modelColumn.isPrimaryKey).toBe(false);
      expect(modelColumn.isDeleted).toBe(false);
    });

    it('should allow optional fields', () => {
      const column = new ModelColumn(
        'column-002',
        'model-001',
        'email',
        'user-001',
        new Date(),
        'user-001',
        'User email address',
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        'Email Address',
        DataType.STRING,
        100,
        undefined,
        undefined,
        true,
        null,
        1,
        false
      );
      expect(column.description).toBe('User email address');
      expect(column.displayName).toBe('Email Address');
      expect(column.isNullable).toBe(true);
      expect(column.orderIndex).toBe(1);
    });

    it('should default optional fields to undefined', () => {
      expect(modelColumn.description).toBeUndefined();
      expect(modelColumn.displayName).toBeUndefined();
      expect(modelColumn.updateTime).toBeUndefined();
      expect(modelColumn.deleteTime).toBeUndefined();
      expect(modelColumn.updatedBy).toBeUndefined();
      expect(modelColumn.deletedBy).toBeUndefined();
    });
  });

  describe('setAsPrimaryKey', () => {
    it('should set isPrimaryKey to true and update timestamps', () => {
      modelColumn.setAsPrimaryKey();
      expect(modelColumn.isPrimaryKey).toBe(true);
      expect(modelColumn.updateTime).toBeDefined();
    });
  });

  describe('unsetAsPrimaryKey', () => {
    it('should set isPrimaryKey to false and update timestamps', () => {
      modelColumn.setAsPrimaryKey();
      modelColumn.unsetAsPrimaryKey();
      expect(modelColumn.isPrimaryKey).toBe(false);
      expect(modelColumn.updateTime).toBeDefined();
    });
  });

  describe('updateOrder', () => {
    it('should update orderIndex and timestamps', () => {
      modelColumn.updateOrder(5);
      expect(modelColumn.orderIndex).toBe(5);
      expect(modelColumn.updateTime).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update multiple fields', () => {
      const updates = {
        name: 'updated_user_id',
        displayName: 'Updated User ID',
        dataType: DataType.NUMBER,
        isNullable: true,
        defaultValue: '0',
        description: 'Updated description',
        orderIndex: 10,
        isPrimaryKey: true
      };

      modelColumn.update(updates);

      expect(modelColumn.name).toBe('updated_user_id');
      expect(modelColumn.displayName).toBe('Updated User ID');
      expect(modelColumn.dataType).toBe(DataType.NUMBER);
      expect(modelColumn.isNullable).toBe(true);
      expect(modelColumn.defaultValue).toBe('0');
      expect(modelColumn.description).toBe('Updated description');
      expect(modelColumn.orderIndex).toBe(10);
      expect(modelColumn.isPrimaryKey).toBe(true);
      expect(modelColumn.updateTime).toBeDefined();
    });

    it('should only update specified fields', () => {
      const originalName = modelColumn.name;
      const originalDataType = modelColumn.dataType;
      modelColumn.update({ isNullable: true });
      expect(modelColumn.name).toBe(originalName);
      expect(modelColumn.dataType).toBe(originalDataType);
      expect(modelColumn.isNullable).toBe(true);
    });

    it('should update length, precision, scale if provided', () => {
      modelColumn.update({ length: 500, precision: 10, scale: 2 });
      expect(modelColumn.length).toBe(500);
      expect(modelColumn.precision).toBe(10);
      expect(modelColumn.scale).toBe(2);
    });

    it('should not update fields not in update object', () => {
      const originalLength = modelColumn.length;
      const originalDescription = modelColumn.description;
      modelColumn.update({ name: 'new_name' });
      expect(modelColumn.length).toBe(originalLength);
      expect(modelColumn.description).toBe(originalDescription);
    });
  });
});

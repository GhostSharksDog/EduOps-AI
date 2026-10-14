import { describe, it, expect } from 'vitest';
import { DataModelAdapterImpl, ModelColumnAdapterImpl } from '@/modules/data/repositories/DataModelAdapterImpl';
import { MockFactory } from '../../helpers/mock-factory';

describe('DataModelAdapterImpl', () => {
  const modelColumnAdapter = new ModelColumnAdapterImpl();
  const adapter = new DataModelAdapterImpl(modelColumnAdapter);

  describe('fromDataModelPOToDataModel', () => {
    it('should convert DataModelPO to DataModel entity', () => {
      const modelPO = MockFactory.createDataModelPO({
        id: 'model-1',
        name: 'Test Model',
      });
      const modelColumnPOs: any[] = [];

      const model = adapter.fromDataModelPOToDataModel(modelPO as any, modelColumnPOs);

      expect(model.id).toBe('model-1');
      expect(model.name).toBe('Test Model');
    });

    it('should handle null description', () => {
      const modelPO = MockFactory.createDataModelPO({
        id: 'model-2',
        name: 'No Description Model',
        description: null,
      });
      const modelColumnPOs: any[] = [];

      const model = adapter.fromDataModelPOToDataModel(modelPO as any, modelColumnPOs);

      expect(model.id).toBe('model-2');
      expect(model.description).toBeUndefined();
    });

    it('should handle different status values', () => {
      const statusValues = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
      
      for (const status of statusValues) {
        const modelPO = MockFactory.createDataModelPO({
          id: `model-${status.toLowerCase()}`,
          name: `${status} Model`,
          status,
        });
        const modelColumnPOs: any[] = [];

        const model = adapter.fromDataModelPOToDataModel(modelPO as any, modelColumnPOs);

        expect(model.status).toBe(status);
      }
    });

    it('should handle model with columns', () => {
      const modelPO = MockFactory.createDataModelPO({
        id: 'model-with-columns',
        name: 'Model with Columns',
      });
      const modelColumnPOs: any[] = [
        { id: 'col-1', modelId: 'model-with-columns', name: 'Column1', dataType: 'STRING' },
        { id: 'col-2', modelId: 'model-with-columns', name: 'Column2', dataType: 'INTEGER' },
      ];

      const model = adapter.fromDataModelPOToDataModel(modelPO as any, modelColumnPOs as any);

      expect(model.id).toBe('model-with-columns');
    });

    it('should handle deleted model', () => {
      const modelPO = MockFactory.createDataModelPO({
        id: 'model-deleted',
        name: 'Deleted Model',
        isDeleted: true,
      });
      const modelColumnPOs: any[] = [];

      const model = adapter.fromDataModelPOToDataModel(modelPO as any, modelColumnPOs);

      expect(model.isDeleted).toBe(true);
    });
  });
});

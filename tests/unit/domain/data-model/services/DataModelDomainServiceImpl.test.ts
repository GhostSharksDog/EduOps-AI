import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataModelDomainServiceImpl } from '@/modules/data/domain/data-model/services/DataModelDomainServiceImpl';
import {
    CreateDataModelCommand,
    UpdateDataModelCommand,
    ModelColumnCreateCommand,
    ModelColumnUpdateCommand
} from '@/modules/data/contracts/data-model/commands/index';
import { ColumnOperation } from '@/modules/data/contracts/data-model/commands/ModelColumnUpdateCommand';
import { DataModelStatus } from '@/shared/enums/index';
import { DataType } from '@/shared/enums/data-models/DataType';
import { DataModel } from '@/modules/data/domain/data-model/entities/DataModel';
import { ModelColumn } from '@/modules/data/domain/data-model/entities/ModelColumn';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';

describe('DataModelDomainServiceImpl', () => {
    let service: DataModelDomainServiceImpl;
    let mockRepository: {
        findByIdForUpdate: ReturnType<typeof vi.fn>;
        findByName: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };

    const createMockDataModel = (columns: ModelColumn[] = []): DataModel => {
        const datasource = new DataSource(
            'ds-001',
            'Test DataSource',
            'user-001',
            new Date(),
            'user-001'
        );

        return new DataModel(
            'model-001',
            'Test Model',
            DataModelStatus.ACTIVE,
            datasource,
            'user-001',
            new Date(),
            'user-001',
            'Test description',
            'test_table',
            columns,
            null,
            false
        );
    };

    const createMockColumn = (id: string, name: string): ModelColumn => {
        return new ModelColumn(
            id,
            'model-001',
            name,
            'user-001',
            new Date(),
            'user-001',
            'Description',
            null,
            false,
            new Date(),
            null,
            null,
            null,
            name,
            DataType.STRING,
            255,
            null,
            null,
            true,
            null,
            0,
            false
        );
    };

    beforeEach(() => {
        mockRepository = {
            findByIdForUpdate: vi.fn(),
            findByName: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        };

        service = new DataModelDomainServiceImpl(mockRepository as any);
    });

    describe('updateDataModel - column deletion', () => {
        it('should pass columns with isDeleted=true to repository when deleting', async () => {
            const existingColumn = createMockColumn('col-001', 'existing_col');

            const dataModel = createMockDataModel([existingColumn]);
            mockRepository.findByIdForUpdate.mockResolvedValue(dataModel);
            mockRepository.findByName.mockResolvedValue(null);
            mockRepository.update.mockImplementation(async (dm: DataModel) => dm);

            const command = new UpdateDataModelCommand(
                'model-001',
                'Updated Model',
                'Updated description',
                'updated_table',
                [
                    new ModelColumnUpdateCommand(
                        ColumnOperation.DELETE,
                        'col-001',
                        'user-002'
                    )
                ],
                undefined,
                undefined,
                'user-002'
            );

            await service.updateDataModel(command);

            expect(mockRepository.update).toHaveBeenCalled();
            const updatedModel = mockRepository.update.mock.calls[0][0] as DataModel;

            expect(updatedModel.columns).toHaveLength(1);
            expect(updatedModel.columns[0].isDeleted).toBe(true);
            expect(updatedModel.columns[0].deletedBy).toBe('user-002');
            expect(updatedModel.columns[0].deleteTime).toBeDefined();
        });

        it('should pass columns with correct updates when updating', async () => {
            const existingColumn = createMockColumn('col-001', 'existing_col');

            const dataModel = createMockDataModel([existingColumn]);
            mockRepository.findByIdForUpdate.mockResolvedValue(dataModel);
            mockRepository.findByName.mockResolvedValue(null);
            mockRepository.update.mockImplementation(async (dm: DataModel) => dm);

            const command = new UpdateDataModelCommand(
                'model-001',
                'Updated Model',
                undefined,
                undefined,
                [
                    new ModelColumnUpdateCommand(
                        ColumnOperation.UPDATE,
                        'col-001',
                        'user-002',
                        undefined,
                        'updated_col',
                        'Updated Column',
                        DataType.NUMBER
                    )
                ],
                undefined,
                undefined,
                'user-002'
            );

            await service.updateDataModel(command);

            const updatedModel = mockRepository.update.mock.calls[0][0] as DataModel;
            expect(updatedModel.columns).toHaveLength(1);
            expect(updatedModel.columns[0].name).toBe('updated_col');
        });

        it('should pass new columns when creating', async () => {
            const dataModel = createMockDataModel([]);
            mockRepository.findByIdForUpdate.mockResolvedValue(dataModel);
            mockRepository.findByName.mockResolvedValue(null);
            mockRepository.update.mockImplementation(async (dm: DataModel) => dm);

            const command = new UpdateDataModelCommand(
                'model-001',
                'Updated Model',
                undefined,
                undefined,
                [
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
                        0,
                        false
                    )
                ],
                undefined,
                undefined,
                'user-002'
            );

            await service.updateDataModel(command);

            const updatedModel = mockRepository.update.mock.calls[0][0] as DataModel;
            expect(updatedModel.columns).toHaveLength(1);
            expect(updatedModel.columns[0].name).toBe('new_col');
            expect(updatedModel.columns[0].isDeleted).toBe(false);
        });

        it('should preserve existing columns when only deleting one', async () => {
            const col1 = createMockColumn('col-001', 'col1');
            const col2 = createMockColumn('col-002', 'col2');
            const col3 = createMockColumn('col-003', 'col3');

            const dataModel = createMockDataModel([col1, col2, col3]);
            mockRepository.findByIdForUpdate.mockResolvedValue(dataModel);
            mockRepository.findByName.mockResolvedValue(null);
            mockRepository.update.mockImplementation(async (dm: DataModel) => dm);

            const command = new UpdateDataModelCommand(
                'model-001',
                'Updated Model',
                undefined,
                undefined,
                [
                    new ModelColumnUpdateCommand(
                        ColumnOperation.DELETE,
                        'col-002',
                        'user-002'
                    )
                ],
                undefined,
                undefined,
                'user-002'
            );

            await service.updateDataModel(command);

            const updatedModel = mockRepository.update.mock.calls[0][0] as DataModel;
            
            expect(updatedModel.columns).toHaveLength(3);
            
            const deletedCol = updatedModel.columns.find(c => c.id === 'col-002');
            expect(deletedCol?.isDeleted).toBe(true);
            
            const otherCols = updatedModel.columns.filter(c => c.id !== 'col-002');
            expect(otherCols).toHaveLength(2);
            expect(otherCols.every(c => !c.isDeleted)).toBe(true);
        });

        it('should preserve existing columns when creating new one', async () => {
            const existingCol = createMockColumn('col-001', 'existing_col');
            
            const dataModel = createMockDataModel([existingCol]);
            mockRepository.findByIdForUpdate.mockResolvedValue(dataModel);
            mockRepository.findByName.mockResolvedValue(null);
            mockRepository.update.mockImplementation(async (dm: DataModel) => dm);

            const command = new UpdateDataModelCommand(
                'model-001',
                'Updated Model',
                undefined,
                undefined,
                [
                    new ModelColumnUpdateCommand(
                        ColumnOperation.CREATE,
                        undefined,
                        'user-002',
                        undefined,
                        'new_col',
                        'New Column',
                        DataType.STRING
                    )
                ],
                undefined,
                undefined,
                'user-002'
            );

            await service.updateDataModel(command);

            const updatedModel = mockRepository.update.mock.calls[0][0] as DataModel;
            
            expect(updatedModel.columns).toHaveLength(2);
            
            const existing = updatedModel.columns.find(c => c.id === 'col-001');
            expect(existing).toBeDefined();
            expect(existing?.isDeleted).toBe(false);
            
            const newCol = updatedModel.columns.find(c => c.name === 'new_col');
            expect(newCol).toBeDefined();
            expect(newCol?.isDeleted).toBe(false);
        });
    });
});

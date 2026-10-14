import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataModelApplicationServiceImpl } from '@/modules/data/services/data-model/DataModelApplicationServiceImpl';
import type {DataModelRepository} from '@/modules/data/domain/ports/DataModelRepository';
import type {DataModelDomainService} from '@/modules/data/domain/data-model/services/ports/DataModelDomainService';
import type {IDataModelOHSAdapter} from '@/modules/data/services/data-model/IDataModelOHSAdapter';

describe('DataModelApplicationServiceImpl', () => {
  let service: DataModelApplicationServiceImpl;
  const count = vi.fn();
  const listDataModels = vi.fn();
  const getDataModel = vi.fn();
  const toVO = vi.fn();
  const toDetail = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    service = new DataModelApplicationServiceImpl(
      {count} as unknown as DataModelRepository,
      {listDataModels, getDataModel} as unknown as DataModelDomainService,
      {fromDataModelToDataModelVO: toVO, fromDataModelToDataModelDetailVO: toDetail} as unknown as IDataModelOHSAdapter,
    );
  });

  it('should be able to instantiate the service', () => {
    expect(service).toBeDefined();
  });

  it('should have createDataModel method', () => {
    expect(typeof service.createDataModel).toBe('function');
  });

  it('should have getDataModel method', () => {
    expect(typeof service.getDataModel).toBe('function');
  });

  it('should have updateDataModel method', () => {
    expect(typeof service.updateDataModel).toBe('function');
  });

  it('should have deleteDataModel method', () => {
    expect(typeof service.deleteDataModel).toBe('function');
  });

  it('should have activateDataModel method', () => {
    expect(typeof service.activateDataModel).toBe('function');
  });

  it('should have deactivateDataModel method', () => {
    expect(typeof service.deactivateDataModel).toBe('function');
  });

  it('should have listDataModels method', () => {
    expect(typeof service.listDataModels).toBe('function');
  });

  it('should have listModelColumns method', () => {
    expect(typeof service.listModelColumns).toBe('function');
  });
  it('keeps the organization filter when obtaining detail', async () => {
    const domainModel = {id: 'model-1'};
    const detail = {id: 'model-1', name: '课程数据'};
    const tenantFilter = {tenantId: 'institution-1', includeShared: false};
    getDataModel.mockResolvedValue(domainModel);
    toDetail.mockReturnValue(detail);
    expect(await service.getDataModel({modelId: 'model-1', tenantFilter})).toEqual(detail);
    expect(getDataModel).toHaveBeenCalledWith('model-1', tenantFilter);
  });

  it('uses the full filtered count for pagination rather than the current page length', async () => {
    const domainModel = {id: 'model-1'};
    const vo = {id: 'model-1', name: '课程数据'};
    const query = {page: 2, pageSize: 10, name: '课程', datasourceId: 'source-1', tenantFilter: {tenantId: 'institution-1'}};
    listDataModels.mockResolvedValue([domainModel]);
    toVO.mockReturnValue(vo);
    count.mockResolvedValue(25);
    expect(await service.listDataModels(query)).toEqual({items: [vo], totalCount: 25, page: 2, pageSize: 10, totalPages: 3});
    expect(count).toHaveBeenCalledWith({name: query.name, status: undefined, datasourceId: query.datasourceId, tenantFilter: query.tenantFilter});
  });
});

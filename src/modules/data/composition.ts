import 'server-only';
import {DatasourceClientAdapterImpl} from '@/platform/database/impl/DatasourceClientAdapterImpl';
import {DatabaseDataSourceRepository} from './repositories/DatabaseDataSourceRepository';
import {DatabaseDataModelRepository} from './repositories/DatabaseDataModelRepository';
import {DataSourceAdapterImpl} from './repositories/DataSourceAdapterImpl';
import {DataSourceDomainServiceImpl} from './domain/datasource/services/DataSourceDomainServiceImpl';
import {DataSourceQueryDomainServiceImpl} from './domain/datasource/services/DataSourceQueryDomainServiceImpl';
import {DataModelDomainServiceImpl} from './domain/data-model/services/DataModelDomainServiceImpl';
import {DataSourceApplicationServiceImpl} from './services/datasource/DataSourceApplicationServiceImpl';
import {DataSourceOHSAdapterImpl} from './services/datasource/DataSourceOHSAdapterImpl';
import {DataModelApplicationServiceImpl} from './services/data-model/DataModelApplicationServiceImpl';
import {DataModelOHSAdapterImpl} from './services/data-model/DataModelOHSAdapterImpl';

const dataSourceRepository = new DatabaseDataSourceRepository(new DataSourceAdapterImpl());
const datasourceClient = new DatasourceClientAdapterImpl();
const dataSourceDomainService = new DataSourceDomainServiceImpl(dataSourceRepository, datasourceClient);
export const dataSourceQueryDomainService = new DataSourceQueryDomainServiceImpl(dataSourceRepository);
export const dataSourceOHSAdapter = new DataSourceOHSAdapterImpl();
export const dataSourceApplicationService = new DataSourceApplicationServiceImpl(
  dataSourceDomainService, dataSourceQueryDomainService, dataSourceOHSAdapter,
);
const dataModelRepository = new DatabaseDataModelRepository();
export const dataModelDomainService = new DataModelDomainServiceImpl(dataModelRepository);
export const dataModelOHSAdapter = new DataModelOHSAdapterImpl();
export const dataModelApplicationService = new DataModelApplicationServiceImpl(
  dataModelRepository, dataModelDomainService, dataModelOHSAdapter,
);

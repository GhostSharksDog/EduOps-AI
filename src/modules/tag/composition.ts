import 'server-only';
import {educationData} from '@/modules/education/server';
import {ClickHouseClientAdapterImpl} from '@/platform/database/impl/ClickHouseClientAdapterImpl';
import {getDatabaseTagRepository} from './repositories/DatabaseTagRepository';
import {getDatabaseTagBitmapSyncStateRepository} from './repositories/DatabaseTagBitmapSyncStateRepository';
import {TargetTableRepositoryImpl} from './repositories/TargetTableRepositoryImpl';
import {TagStorageConfigRepositoryImpl} from './repositories/TagStorageConfigRepositoryImpl';
import {BitmapTableRepositoryImpl} from './repositories/BitmapTableRepositoryImpl';
import {TagRefreshLogRepositoryImpl} from './repositories/TagRefreshLogRepositoryImpl';
import {DatabaseMaterializedViewConfigRepository} from './repositories/DatabaseMaterializedViewConfigRepository';
import {DatabaseRiskProposalRepository} from './repositories/risk-repository';
import {TagFactoryImpl} from './domain/factories/TagFactoryImpl';
import {TagDomainServiceImpl} from './domain/services/TagDomainServiceImpl';
import {TagQueryDomainServiceImpl} from './domain/services/TagQueryDomainServiceImpl';
import {TagVersionDomainServiceImpl} from './domain/services/TagVersionDomainServiceImpl';
import {TagCategoryDomainServiceImpl} from './domain/services/TagCategoryDomainServiceImpl';
import {TagBitmapSyncDomainServiceImpl} from './domain/services/TagBitmapSyncDomainServiceImpl';
import {MaterializedViewDomainServiceImpl} from './domain/services/MaterializedViewDomainServiceImpl';
import {BitmapManagementDomainServiceImpl} from './domain/services/BitmapManagementDomainServiceImpl';
import {TagApplicationServiceImpl} from './services/TagApplicationServiceImpl';
import {TagCategoryApplicationServiceImpl} from './services/TagCategoryApplicationServiceImpl';
import {TagQueryApplicationServiceImpl} from './services/TagQueryApplicationServiceImpl';
import {TagOHSAdapterImpl} from './services/TagOHSAdapterImpl';
import {TagVersionOHSAdapterImpl} from './services/TagVersionOHSAdapterImpl';
import {TagCategoryOHSAdapterImpl} from './services/TagCategoryOHSAdapterImpl';
import {TagActivationApplicationServiceImpl} from './services/TagActivationApplicationServiceImpl';
import {TagValueQueryApplicationServiceImpl} from './services/TagValueQueryApplicationServiceImpl';
import {TagRefreshMonitorServiceImpl} from './services/TagRefreshMonitorServiceImpl';
import {TagRuleValidationServiceImpl} from './services/TagRuleValidationServiceImpl';
import {BitmapApplicationServiceImpl} from './services/bitmap/BitmapApplicationServiceImpl';
import {BitmapOHSAdapterImpl} from './services/bitmap/BitmapOHSAdapterImpl';
import {TargetTableApplicationServiceImpl} from './services/target-table/TargetTableApplicationServiceImpl';
import {TargetTableOHSAdapterImpl} from './services/target-table/TargetTableOHSAdapterImpl';
import {RiskTagService} from './services/risk-service';

// 本模块的服务与仓储只在这里装配，所有入口共享相同实例。
const tagRepository = getDatabaseTagRepository();
const targetTableRepository = new TargetTableRepositoryImpl();
const storageRepository = new TagStorageConfigRepositoryImpl();
const bitmapRepository = new BitmapTableRepositoryImpl();
const refreshLogRepository = new TagRefreshLogRepositoryImpl();
const mvRepository = new DatabaseMaterializedViewConfigRepository();
const chClient = new ClickHouseClientAdapterImpl();
const factory = new TagFactoryImpl();
const tagDomainService = new TagDomainServiceImpl(tagRepository, factory, targetTableRepository);
export const tagQueryDomainService = new TagQueryDomainServiceImpl(tagRepository);
const tagVersionDomainService = new TagVersionDomainServiceImpl(tagRepository);
const tagCategoryDomainService = new TagCategoryDomainServiceImpl(tagRepository, factory);
const bitmapSyncDomainService = new TagBitmapSyncDomainServiceImpl(
  getDatabaseTagBitmapSyncStateRepository(), storageRepository, chClient, tagRepository, targetTableRepository,
);
const mvDomainService = new MaterializedViewDomainServiceImpl(chClient);
const bitmapManagementService = new BitmapManagementDomainServiceImpl(bitmapRepository, chClient);
export const tagOHSAdapter = new TagOHSAdapterImpl();
export const tagVersionOHSAdapter = new TagVersionOHSAdapterImpl();
export const tagCategoryOHSAdapter = new TagCategoryOHSAdapterImpl();
const bitmapOHSAdapter = new BitmapOHSAdapterImpl();
const targetTableOHSAdapter = new TargetTableOHSAdapterImpl();
const bitmapApplicationService = new BitmapApplicationServiceImpl(
  bitmapManagementService, bitmapRepository, bitmapOHSAdapter, storageRepository,
);
export const tagApplicationService = new TagApplicationServiceImpl(
  tagDomainService, tagVersionDomainService, tagQueryDomainService, tagOHSAdapter, tagVersionOHSAdapter,
  bitmapApplicationService, mvRepository, targetTableRepository, chClient,
);
export const tagCategoryApplicationService = new TagCategoryApplicationServiceImpl(
  tagCategoryDomainService, tagQueryDomainService, tagCategoryOHSAdapter,
);
export const tagQueryApplicationService = new TagQueryApplicationServiceImpl(tagQueryDomainService, tagOHSAdapter);
const activationService = new TagActivationApplicationServiceImpl(
  tagDomainService, mvDomainService, bitmapManagementService, chClient, bitmapApplicationService,
  bitmapSyncDomainService, mvRepository, targetTableRepository,
);
const valueQueryService = new TagValueQueryApplicationServiceImpl(
  tagDomainService, chClient, mvRepository, targetTableRepository,
);
const refreshMonitorService = new TagRefreshMonitorServiceImpl(
  tagDomainService, mvDomainService, refreshLogRepository, mvRepository,
);
const ruleValidationService = new TagRuleValidationServiceImpl();
const targetTableApplicationService = new TargetTableApplicationServiceImpl(
  targetTableRepository, targetTableOHSAdapter, chClient, tagRepository,
);
export const riskTags = new RiskTagService(new DatabaseRiskProposalRepository(), educationData);

export const getTagDomainService = () => tagDomainService;
export const getTagQueryDomainService = () => tagQueryDomainService;
export const getTagVersionDomainService = () => tagVersionDomainService;
export const getTagCategoryDomainService = () => tagCategoryDomainService;
export const getITagFactory = () => factory;
export const getTagBitmapSyncDomainService = () => bitmapSyncDomainService;
export const getClickHouseClient = () => chClient;
export const getBitmapTableRepository = () => bitmapRepository;
export const getTagRefreshLogRepository = () => refreshLogRepository;
export const getMvConfigRepository = () => mvRepository;
export const getMvDomainService = () => mvDomainService;
export const getBitmapManagementService = () => bitmapManagementService;
export const getTagActivationApplicationService = () => activationService;
export const getTagValueQueryApplicationService = () => valueQueryService;
export const getTagRefreshMonitorService = () => refreshMonitorService;
export const getTagRuleValidationService = () => ruleValidationService;
export const getBitmapOHSAdapter = () => bitmapOHSAdapter;
export const getTagStorageConfigRepository = () => storageRepository;
export const getTargetTableRepository = () => targetTableRepository;
export const getBitmapApplicationService = () => bitmapApplicationService;
export const getTargetTableOHSAdapter = () => targetTableOHSAdapter;
export const getTargetTableApplicationService = () => targetTableApplicationService;
export {riskTagRouteAuth} from './services/risk-route-auth';

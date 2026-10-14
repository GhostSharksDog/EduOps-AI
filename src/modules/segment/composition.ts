import 'server-only';
import {riskTags, tagQueryDomainService} from '@/modules/tag/server';
import {DatabaseSegmentRepository} from './repositories/DatabaseSegmentRepository';
import {DatabaseRiskSegmentRepository} from './repositories/risk-snapshot-repository';
import {SegmentDomainServiceImpl} from './domain/services/SegmentDomainServiceImpl';
import {SegmentFactoryImpl} from './domain/factories/SegmentFactoryImpl';
import {SegmentOHSAdapterImpl} from './services/SegmentOHSAdapterImpl';
import {SegmentQueryApplicationServiceImpl} from './services/SegmentQueryApplicationServiceImpl';
import {SegmentManagementApplicationServiceImpl} from './services/SegmentManagementApplicationServiceImpl';
import {RiskSegmentService} from './services/risk-snapshot-service';

const repository = new DatabaseSegmentRepository();
export const segmentOHSAdapter = new SegmentOHSAdapterImpl();
const domain = new SegmentDomainServiceImpl(repository, new SegmentFactoryImpl(), tagQueryDomainService);
export const segmentQueryApplicationService = new SegmentQueryApplicationServiceImpl(repository, segmentOHSAdapter);
export const segmentManagementApplicationService = new SegmentManagementApplicationServiceImpl(repository, domain, segmentOHSAdapter);
export const riskSegments = new RiskSegmentService(new DatabaseRiskSegmentRepository(), riskTags);
export {riskSegmentRouteAuth} from './services/risk-route-auth';

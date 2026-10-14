import 'server-only';
import {riskSegments} from '@/modules/segment/server';
import {RiskProfileService} from './services/risk-profile-service';
export const riskProfiles=new RiskProfileService(riskSegments);

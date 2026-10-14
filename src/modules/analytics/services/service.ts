import type {CapabilityResult} from '@/shared/contracts/analysis';
export function getCapability():CapabilityResult<null>{return {status:'ready',message:'已支持八项经营指标、周期对比、校区课程及渠道拆解；渠道按同校区同课程首购归属，未知来源单列。',data:null};}

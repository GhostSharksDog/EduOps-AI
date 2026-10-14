import {describe,it,expect} from 'vitest';
import {analysisScopeSchema} from '@/shared/contracts/analysis';
import {agentTools} from '@/modules/agent/services/tool-registry';
import {metricDefinitions} from '@/modules/analytics/domain/metrics';
describe('分析契约',()=>{
 it('拒绝反向日期和客户端伪造授权范围',()=>{expect(analysisScopeSchema.safeParse({startDate:'2027-01-10',endDate:'2027-01-01'}).success).toBe(false);expect(analysisScopeSchema.safeParse({startDate:'2027-01-01',endDate:'2027-01-10',organizationId:'forged'}).success).toBe(false);});
 it('覆盖开题要求的8个运营维度，并明确分子分母',()=>{expect(metricDefinitions).toHaveLength(8);for(const d of metricDefinitions){expect(d.numerator.length).toBeGreaterThan(0);expect(d.denominator.length).toBeGreaterThan(0);}});
 it('Agent工具仅允许查询或提出草稿，不直接发布业务对象',()=>{expect(agentTools.length).toBeGreaterThan(0);expect(agentTools.every(t=>['read','propose'].includes(t.mode))).toBe(true);expect(agentTools.some(t=>/publish|activate|delete/.test(t.name))).toBe(false);});
});

import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {seedOperationsFixture,deleteOperationsFixture,guardOperationsTest} from '../performance/operations-fixture';
import {operations} from '@/modules/analytics/server';
import {calculateOperations} from '@/modules/analytics/domain/operations';
import {OperationsRepository} from '@/modules/analytics/repositories/operations-repository';
import {channelFunnel} from '@/modules/analytics/services/channels-service';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
let fixture:Awaited<ReturnType<typeof seedOperationsFixture>>;
beforeAll(async()=>{guardOperationsTest();fixture=await seedOperationsFixture({students:60,replication:2});},120000);
afterAll(async()=>{if(fixture)await deleteOperationsFixture(fixture.org);},60000);
const sorted=(rows:unknown[])=>rows.map(r=>JSON.stringify(r,Object.keys(r as object).sort())).sort();
const pick=(result:ReturnType<typeof calculateOperations>)=>({metrics:result.metrics.map(({evidence,...m})=>m),trend:sorted(result.trend),breakdown:sorted(result.breakdown),riskStudents:result.riskStudents});
describe('经营SQL聚合与独立纯计算器对照',()=>{
 for(const input of [
  {startDate:'2026-08-01',endDate:'2026-08-31'},
  {startDate:'2026-04-01',endDate:'2026-04-30'},
  {startDate:'2026-03-01',endDate:'2026-03-31'},
  {startDate:'2026-08-01',endDate:'2026-08-31',channelIds:['online']},
  {startDate:'2026-08-01',endDate:'2026-08-31',channelIds:['__unknown__']},
  {startDate:'2026-09-01',endDate:'2026-09-30',campusIds:['sim:campus:1'],courseIds:['sim:course:1']},
  {startDate:'2026-06-01',endDate:'2026-06-30',dataCutoff:'2026-06-15T02:00:00.000Z'},
  {startDate:'2026-10-01',endDate:'2026-10-31'},
 ])it('范围 '+JSON.stringify(input),async()=>{
  const scope:AuthorizedScope={organizationId:fixture.org,authorizedCampusIds:[],campusIds:[],courseIds:[],channelIds:[],...input};
  const actual=await operations.query(fixture.datasetId,scope,undefined,false),expected=calculateOperations(fixture.snapshot,scope);
  expect(pick(actual)).toEqual(pick(expected));
  const repository=new OperationsRepository(),prepared=await repository.prepare(fixture.org,fixture.datasetId),details=await repository.summarize(prepared,scope),funnel=channelFunnel(fixture.snapshot,{...expected.scope,observationCutoff:scope.dataCutoff??fixture.snapshot.dataset.dataCutoff});expect(details.funnel).toEqual(funnel);
 },60000);
 it('机构隔离拒绝其他机构读取元数据或行为',async()=>{await expect(operations.query(fixture.datasetId,{organizationId:randomUUID(),authorizedCampusIds:[],campusIds:[],courseIds:[],channelIds:[],startDate:'2026-08-01',endDate:'2026-08-31'})).rejects.toMatchObject({status:404});});
});

import {describe,it,expect} from 'vitest';
import {OperationsService} from '@/modules/analytics/services/operations-service';
import type {EducationSnapshot,ImportResultVO} from '@/modules/education/contracts';
const scope={organizationId:'org',authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
const dataset={id:'dataset',key:'test',name:'测试',origin:'simulated' as const,license:'测试',schemaVersion:'1' as const,description:'测试',dataCutoff:'2026-09-30T15:59:59.000Z',createdAt:'2026-01-01T00:00:00.000Z'};
const batch=(id:string):ImportResultVO=>({id,datasetId:dataset.id,kind:'attendance',filename:'test.csv',fileHash:'hash-'+id,status:'completed',acceptedRows:0,inputRows:0,rejectedRows:0,duplicateRows:0,issues:[],error:null,createdAt:dataset.createdAt,completedAt:dataset.dataCutoff});
describe('指标证据绑定数据批次与范围',()=>{
 it('相同完成批次的排列不影响版本，新批次与文件变化会更新证据版本',async()=>{
  const snapshot:EducationSnapshot={dataset,records:[],batches:[batch('a'),batch('b')]};
  const service=new OperationsService({snapshot:async()=>snapshot});
  const version=async()=> (await service.query(dataset.id,scope,['attendance_rate'])).metrics[0].evidence[0].version;
  const first=await version();snapshot.batches.reverse();expect(await version()).toBe(first);
  snapshot.batches[0].fileHash='changed';expect(await version()).not.toBe(first);
  snapshot.batches[0].fileHash='hash-'+snapshot.batches[0].id;snapshot.batches.push(batch('c'));expect(await version()).not.toBe(first);
 });
 it('改变分析范围会更新引用版本，未完成批次不参与',async()=>{
  const snapshot:EducationSnapshot={dataset,records:[],batches:[batch('a')]};const service=new OperationsService({snapshot:async()=>snapshot});
  const first=(await service.query(dataset.id,scope,['attendance_rate'])).metrics[0].evidence[0].version;
  snapshot.batches.push({...batch('running'),status:'running'});
  expect((await service.query(dataset.id,scope,['attendance_rate'])).metrics[0].evidence[0].version).toBe(first);
  expect((await service.query(dataset.id,{...scope,startDate:'2026-08-02'},['attendance_rate'])).metrics[0].evidence[0].version).not.toBe(first);
 });
});

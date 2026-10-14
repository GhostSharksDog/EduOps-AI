import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {execute,queryOne,transaction} from '@/platform/database';
import {BitmapTableRepositoryImpl} from '@/modules/tag/repositories/BitmapTableRepositoryImpl';
import {RecycleBinApplicationServiceImpl} from '@/modules/system/services/recycle-bin/RecycleBinApplicationServiceImpl';
import {RecycleBinItemType} from '@/shared/enums';
import type {BitmapTableData} from '@/modules/tag/domain/ports/IBitmapTableRepository';

const organizationId=randomUUID(),otherOrganizationId=randomUUID();
const repository=new BitmapTableRepositoryImpl();
let connectionValidated=false;
function assertDedicatedDatabase(){
 const raw=process.env.DATABASE_URL;if(!raw)throw new Error('必须显式提供专用测试数据库');
 const url=new URL(raw);if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test')throw new Error('位图回归仅允许本机25432的education_cleanup_test');
}
async function assertCurrentDatabase(){
 assertDedicatedDatabase();
 const row=await queryOne<{name:string}>('SELECT current_database() AS name');
 if(row?.name!=='education_cleanup_test')throw new Error('实际数据库不是专用测试库');
}
function sample(overrides:Partial<BitmapTableData>={}):BitmapTableData{
 return {id:randomUUID(),entityType:'STUDENT',entityTypeId:randomUUID(),ownedBy:organizationId,sequence:1,totalBits:64,usedBits:[],status:'ACTIVE',createTime:new Date(),...overrides};
}
beforeAll(async()=>{await assertCurrentDatabase();connectionValidated=true;});
afterAll(async()=>{
 if(!connectionValidated)return;await assertCurrentDatabase();
 // 仅清理本次随机机构创建的位图，保留测试库其余记录。
 await execute('DELETE FROM bitmap_table WHERE owned_by=ANY($1::uuid[])',[[organizationId,otherOrganizationId]]);
});
describe('真实pg位图仓储',()=>{
 it('创建真实UUID记录并保留位数、JSON和日期',async()=>{
  const input=sample({usedBits:[0,7]});const created=await repository.create(input);
  expect(created).toMatchObject({id:input.id,ownedBy:organizationId,entityTypeId:input.entityTypeId,totalBits:64,usedBits:[0,7],status:'ACTIVE',isDeleted:false});
  expect(created.createTime).toBeInstanceOf(Date);
 });
 it('根据编号读取已保存记录',async()=>{
  const created=await repository.create(sample());expect(await repository.findById(created.id)).toMatchObject({id:created.id,ownedBy:organizationId});
 });
 it('不存在的真实UUID返回null',async()=>{expect(await repository.findById(randomUUID())).toBeNull();});
 it('按实体类型编号读取全部机构内记录',async()=>{
  const entityTypeId=randomUUID(),first=await repository.create(sample({entityTypeId})),second=await repository.create(sample({entityTypeId,sequence:2}));
  const rows=await repository.findByEntityTypeId(entityTypeId,false,{tenantId:organizationId});
  expect(rows.map(row=>row.id).sort()).toEqual([first.id,second.id].sort());
 });
 it('查询可用的ACTIVE位图，排除INACTIVE和删除记录',async()=>{
  const entityTypeId=randomUUID(),inactive=await repository.create(sample({entityTypeId,status:'INACTIVE'})),active=await repository.create(sample({entityTypeId,sequence:2}));
  expect((await repository.findActiveByEntityTypeId(entityTypeId))?.id).toBe(active.id);
  await repository.delete(active.id);expect(await repository.findActiveByEntityTypeId(entityTypeId)).toBeNull();
  expect((await repository.findById(inactive.id))?.status).toBe('INACTIVE');
 });
 it('没有ACTIVE位图时返回null',async()=>{expect(await repository.findActiveByEntityTypeId(randomUUID())).toBeNull();});
 it('按机构列出全部未删除位图',async()=>{
  const created=await repository.create(sample()),foreign=await repository.create(sample({ownedBy:otherOrganizationId}));
  const rows=await repository.findAll({tenantId:organizationId});
  expect(rows.some(row=>row.id===created.id)).toBe(true);expect(rows.some(row=>row.id===foreign.id)).toBe(false);
 });
 it('更新有效位图状态、已用位及ClickHouse表名',async()=>{
  const created=await repository.create(sample()),updated=await repository.update({...created,status:'INACTIVE',usedBits:[4,5],chTableName:'test_bitmap_mapping'});
  expect(updated).toMatchObject({id:created.id,status:'INACTIVE',usedBits:[4,5],chTableName:'test_bitmap_mapping'});
  expect(await repository.findById(created.id)).toMatchObject({status:'INACTIVE',usedBits:[4,5]});
 });
 it('软删除保留记录并进入本机构回收站',async()=>{
  const created=await repository.create(sample());await repository.delete(created.id);
  expect(await repository.findById(created.id)).toMatchObject({id:created.id,isDeleted:true,deleteTime:expect.any(Date)});
  expect((await repository.findAll({tenantId:organizationId})).some(row=>row.id===created.id)).toBe(false);
  const recycled=await new RecycleBinApplicationServiceImpl().listRecycleBinItems({type:RecycleBinItemType.BITMAP_TABLE,page:1,pageSize:100,tenantFilter:{tenantId:organizationId}});
  expect(recycled.items.some(item=>item.id===created.id&&item.type===RecycleBinItemType.BITMAP_TABLE)).toBe(true);
 });
 it('原子分配复用已有表，选择第一个空位',async()=>{
  const entityTypeId=randomUUID(),created=await repository.create(sample({entityTypeId,usedBits:[0,1,2]}));
  const allocated=await repository.allocateBitAtomically(entityTypeId,'STUDENT',organizationId);
  expect(allocated).toMatchObject({bitPosition:3,isNewTable:false,bitmapTableData:{id:created.id,usedBits:[0,1,2,3]}});
 });
 it('原子释放仅移除指定位置，重复释放返回null',async()=>{
  const created=await repository.create(sample({usedBits:[0,1,2]}));
  expect(await repository.releaseBitAtomically(created.id,0)).toMatchObject({usedBits:[1,2]});
  expect(await repository.releaseBitAtomically(created.id,0)).toBeNull();
 });
 it('并发分配不会重复占用同一位置，也不会创建重复表',async()=>{
  const entityTypeId=randomUUID();const allocations=await Promise.all(Array.from({length:12},()=>repository.allocateBitAtomically(entityTypeId,'STUDENT',organizationId)));
  expect(new Set(allocations.map(row=>row.bitmapTableData.id)).size).toBe(1);
  expect(allocations.filter(row=>row.isNewTable)).toHaveLength(1);
  expect(allocations.map(row=>row.bitPosition).sort((a,b)=>a-b)).toEqual(Array.from({length:12},(_,i)=>i));
  expect((await repository.findByEntityTypeId(entityTypeId,false,{tenantId:organizationId}))[0].usedBits).toHaveLength(12);
 });
 it('第65次分配建立第二表，保留第一表完整位集',async()=>{
  const entityTypeId=randomUUID();const allocations=[];
  for(let i=0;i<65;i++)allocations.push(await repository.allocateBitAtomically(entityTypeId,'STUDENT',organizationId));
  expect(new Set(allocations.map(row=>row.bitmapTableData.id)).size).toBe(2);
  expect(allocations[64]).toMatchObject({bitPosition:0,isNewTable:true,bitmapTableData:{sequence:2,usedBits:[0]}});
  const tables=await repository.findByEntityTypeId(entityTypeId,false,{tenantId:organizationId});
  expect(tables).toHaveLength(2);expect(tables.find(row=>row.sequence===1)?.usedBits).toEqual(Array.from({length:64},(_,i)=>i));
 });
 it('同一个固定实体类型编号可在两个机构独立分配',async()=>{
  const entityTypeId='00000000-0000-4000-8000-000000000001';
  const [first,second]=await Promise.all([repository.allocateBitAtomically(entityTypeId,'STUDENT',organizationId),repository.allocateBitAtomically(entityTypeId,'STUDENT',otherOrganizationId)]);
  expect(first.bitmapTableData.id).not.toBe(second.bitmapTableData.id);expect(first.bitPosition).toBe(0);expect(second.bitPosition).toBe(0);
  expect(first.bitmapTableData.ownedBy).toBe(organizationId);expect(second.bitmapTableData.ownedBy).toBe(otherOrganizationId);
  expect((await repository.findByEntityTypeId(entityTypeId,false,{tenantId:organizationId})).map(row=>row.id)).toEqual([first.bitmapTableData.id]);
  expect((await repository.findByEntityTypeId(entityTypeId,false,{tenantId:otherOrganizationId})).map(row=>row.id)).toEqual([second.bitmapTableData.id]);
 });
 it('指定位置分配校验范围和重复占用，事务回滚保留原位集',async()=>{
  const created=await repository.create(sample({usedBits:[0]}));
  await expect(repository.assignBitAt(created.id,64)).rejects.toThrow('超出范围');
  await expect(repository.assignBitAt(created.id,0)).rejects.toThrow('已分配');
  await expect(transaction(async client=>{await repository.assignBitAt(created.id,7,client);throw new Error('rollback-fixture');})).rejects.toThrow('rollback-fixture');
  expect((await repository.findById(created.id))?.usedBits).toEqual([0]);
  expect(await repository.assignBitAt(created.id,7)).toMatchObject({usedBits:[0,7]});
  expect(await repository.releaseBitAt(created.id,7)).toMatchObject({usedBits:[0]});
 });
});


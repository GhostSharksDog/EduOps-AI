import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {db,execute,queryOne} from '@/platform/database';
import {config} from '@/platform/config';
import {BitmapTableRepositoryImpl} from '@/modules/tag/repositories/BitmapTableRepositoryImpl';
import {TagStorageConfigRepositoryImpl} from '@/modules/tag/repositories/TagStorageConfigRepositoryImpl';
import {TagRefreshLogRepositoryImpl} from '@/modules/tag/repositories/TagRefreshLogRepositoryImpl';
import {BitmapApplicationServiceImpl} from '@/modules/tag/services/bitmap/BitmapApplicationServiceImpl';
import {BitmapOHSAdapterImpl} from '@/modules/tag/services/bitmap/BitmapOHSAdapterImpl';
import type {IBitmapManagementDomainService} from '@/modules/tag/domain/services/ports/IBitmapManagementDomainService';

const ownOrg=randomUUID(),otherOrg=randomUUID(),actor=randomUUID();
const ownBitmap=randomUUID(),otherBitmap=randomUUID(),entityTypeId=randomUUID();
const ownTag=randomUUID(),otherTag=randomUUID(),categoryId=randomUUID();
const ownLog=randomUUID(),otherLog=randomUUID();
const own={tenantId:ownOrg},other={tenantId:otherOrg};
const bitmaps=new BitmapTableRepositoryImpl(),logs=new TagRefreshLogRepositoryImpl();
const service=new BitmapApplicationServiceImpl({} as IBitmapManagementDomainService,bitmaps,new BitmapOHSAdapterImpl(),new TagStorageConfigRepositoryImpl());
let verified=false;
function assertDatabase(){
  const url=process.env.DATABASE_URL&&new URL(process.env.DATABASE_URL);
  if(!url||url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test')throw new Error('只允许专用 education_cleanup_test 数据库');
}
beforeAll(async()=>{
  assertDatabase();
  expect((await queryOne<{name:string}>('SELECT current_database() AS name'))?.name).toBe('education_cleanup_test');
  verified=true;
  for(const [id,org]of [[ownBitmap,ownOrg],[otherBitmap,otherOrg]]as const){
    await bitmaps.create({id,entityType:'STUDENT',entityTypeId,ownedBy:org,sequence:1,totalBits:64,usedBits:[3],status:'ACTIVE',createTime:new Date()});
  }
  await execute('INSERT INTO tag_category(id,name,owned_by,path,created_by) VALUES($1,$2,$3,$4,$5)',[categoryId,'管理权限测试_'+randomUUID(),config.system.userId,'/'+categoryId,actor]);
  for(const [id,org]of [[ownTag,ownOrg],[otherTag,otherOrg]]as const){
    await execute('INSERT INTO tag(id,name,owned_by,value_type,category_id,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,'管理权限标签_'+randomUUID(),org,'STRING',categoryId,actor]);
  }
  for(const [id,tagId,ownedBy]of [[ownLog,ownTag,ownOrg],[otherLog,otherTag,otherOrg]]as const){
    await logs.create({id,tagId,ownedBy,mvName:'fixture_mv_'+tagId,errorMessage:'synthetic_refresh_error',occurredAt:new Date(),isResolved:false,createTime:new Date()});
  }
});
afterAll(async()=>{
  if(!verified)return;
  assertDatabase();
  // 只移除本文件随机编号的测试记录。
  await execute('DELETE FROM tag_refresh_log WHERE id=ANY($1::uuid[])',[[ownLog,otherLog]]);
  await execute('DELETE FROM tag_storage_config WHERE tag_id=ANY($1::uuid[])',[[ownTag,otherTag]]);
  await execute('DELETE FROM tag WHERE id=ANY($1::uuid[])',[[ownTag,otherTag]]);
  await execute('DELETE FROM tag_category WHERE id=$1',[categoryId]);
  await execute('DELETE FROM bitmap_table WHERE id=ANY($1::uuid[])',[[ownBitmap,otherBitmap]]);
  await db.end();
});

describe('位图和刷新监控的真实机构边界',()=>{
  it('同实体类型的活跃位图按机构读取，越权更新不改原记录',async()=>{
    expect((await bitmaps.findById(ownBitmap,own))?.ownedBy).toBe(ownOrg);
    expect(await bitmaps.findById(ownBitmap,other)).toBeNull();
    expect((await bitmaps.findActiveByEntityTypeId(entityTypeId,own))?.id).toBe(ownBitmap);
    expect((await bitmaps.findActiveByEntityTypeId(entityTypeId,other))?.id).toBe(otherBitmap);
    const row=(await bitmaps.findById(ownBitmap,own))!;
    await expect(bitmaps.update({...row,status:'INACTIVE'},other)).rejects.toThrow('位图表不存在');
    expect((await bitmaps.findById(ownBitmap,own))?.status).toBe('ACTIVE');
  });

  it('详情在同步位集之前验证机构，跨机构读取不改变孤儿位',async()=>{
    expect(await service.getBitmapTableDetail(ownBitmap,other)).toBeNull();
    expect((await bitmaps.findById(ownBitmap,own))?.usedBits).toEqual([3]);
  });

  it('状态、分配、释放及清理均拒绝外机构位图',async()=>{
    await expect(service.updateBitmapTableStatus(ownBitmap,{status:'INACTIVE'},other)).rejects.toMatchObject({name:'NotFoundException',httpStatus:404});
    await expect(service.assignBitToTag(ownBitmap,4,otherTag,actor,undefined,undefined,undefined,other)).rejects.toMatchObject({name:'NotFoundException',httpStatus:404});
    await expect(service.releaseBit(ownBitmap,3,other)).rejects.toMatchObject({name:'NotFoundException',httpStatus:404});
    await expect(service.unassignBit(ownBitmap,3,actor,other)).rejects.toMatchObject({name:'NotFoundException',httpStatus:404});
    await expect(service.releaseUnusedBits(ownBitmap,other)).rejects.toMatchObject({name:'NotFoundException',httpStatus:404});
    expect((await bitmaps.findById(ownBitmap,own))?.usedBits).toEqual([3]);
  });

  it('不能将外机构标签分配到自己的位图',async()=>{
    await expect(service.assignBitToTag(ownBitmap,4,otherTag,actor,undefined,undefined,undefined,own)).rejects.toMatchObject({name:'NotFoundException',httpStatus:404});
    expect((await bitmaps.findById(ownBitmap,own))?.usedBits).toEqual([3]);
    expect((await queryOne<{count:number}>('SELECT COUNT(*)::int AS count FROM tag_storage_config WHERE tag_id=$1',[otherTag]))?.count).toBe(0);
  });

  it('未解决日志列表仅返回本机构，内部不传范围的查询仍兼容',async()=>{
    expect((await logs.findUnresolved(100,own)).map(row=>row.id)).toEqual([ownLog]);
    expect((await logs.findUnresolved(100,other)).map(row=>row.id)).toEqual([otherLog]);
    const internal=await logs.findUnresolved(1000);
    expect(internal.some(row=>row.id===ownLog)).toBe(true);
    expect(internal.some(row=>row.id===otherLog)).toBe(true);
  });

  it('跨机构解决返回404且不改变状态，本机构重复解决可复用',async()=>{
    await expect(logs.markResolved(otherLog,own)).rejects.toMatchObject({name:'NotFoundException',httpStatus:404});
    expect((await queryOne<{is_resolved:boolean}>('SELECT is_resolved FROM tag_refresh_log WHERE id=$1',[otherLog]))?.is_resolved).toBe(false);
    await logs.markResolved(ownLog,own);
    await logs.markResolved(ownLog,own);
    expect((await queryOne<{is_resolved:boolean}>('SELECT is_resolved FROM tag_refresh_log WHERE id=$1',[ownLog]))?.is_resolved).toBe(true);
  });
});

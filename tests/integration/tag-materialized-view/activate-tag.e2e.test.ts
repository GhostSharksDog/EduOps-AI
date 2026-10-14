import {randomUUID} from 'node:crypto';
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {ClickHouseClientAdapterImpl} from '@/platform/database/impl/ClickHouseClientAdapterImpl';
if(!process.env.CLICKHOUSE_DATABASE?.endsWith('_test'))throw new Error('ClickHouse集成测试要求专用*_test库');
const ch=new ClickHouseClientAdapterImpl(),prefix='api_mv_'+randomUUID().replaceAll('-','');
const source=prefix+'_source',target=prefix+'_target',mv=prefix+'_view',refreshTarget=prefix+'_refresh_target',refreshView=prefix+'_refresh_view',bitmap=prefix+'_bitmap',syncSource=prefix+'_sync_source',syncBitmap=prefix+'_sync_bitmap',signedSource=prefix+'_signed_source';
beforeAll(async()=>{expect((await ch.query<{db:string}>('SELECT currentDatabase() AS db'))[0].db).toBe(process.env.CLICKHOUSE_DATABASE);});
afterAll(async()=>{for(const name of [mv,refreshView])await ch.dropMaterializedView(name);for(const name of [target,refreshTarget,bitmap,source,syncSource,syncBitmap,signedSource])await ch.dropTable(name);});
async function waitValue(table:string,value:string){for(let i=0;i<40;i++){const rows=await ch.query<{entity_id:string;tag_value:string}>(`SELECT entity_id,tag_value FROM ${table} WHERE tag_value='${value}'`);if(rows.length)return rows;await new Promise(r=>setTimeout(r,200));}throw new Error('物化视图未产生预期结果');}
describe('实际ClickHouse物化视图与位图',()=>{
 it('实时物化视图将新增业务记录写入结果表',async()=>{
  await ch.createTable('CREATE TABLE '+source+' (entity_id String,tag_value String) ENGINE=MergeTree ORDER BY entity_id');
  await ch.createTable('CREATE TABLE '+target+' (entity_id String,tag_value String) ENGINE=MergeTree ORDER BY entity_id');
  await ch.createMaterializedView(mv,target,'','SELECT entity_id,tag_value FROM '+source,true);
  await ch.execute('INSERT INTO '+source+" VALUES ('student-1','risk')");
  expect(await waitValue(target,'risk')).toEqual([{entity_id:'student-1',tag_value:'risk'}]);
 });
 it('定时视图可刷新、暂停和恢复，并返回真实刷新状态',async()=>{
  await ch.createTable('CREATE TABLE '+refreshTarget+' (entity_id String,tag_value String) ENGINE=MergeTree ORDER BY entity_id');
  await ch.createMaterializedView(refreshView,refreshTarget,'REFRESH EVERY 1 HOUR','SELECT entity_id,tag_value FROM '+source,false);
  await ch.execute('SYSTEM REFRESH VIEW '+refreshView);expect(await waitValue(refreshTarget,'risk')).toHaveLength(1);
  await ch.stopView(refreshView);expect(await ch.getRefreshStatus(refreshView)).not.toBeNull();
  await ch.startView(refreshView);expect(await ch.getRefreshStatus(refreshView)).toMatchObject({name:refreshView});
 });
 it('清除第40位不会误清低位或保留目标位',async()=>{
  await ch.createTable('CREATE TABLE '+bitmap+' (entity_id String,bitmap_col UInt64) ENGINE=MergeTree ORDER BY entity_id');
  await ch.execute('INSERT INTO '+bitmap+" VALUES ('student-1',1099511628033)");
  await ch.resetBitmapBit(bitmap,40);
  for(let i=0;i<40;i++){const rows=await ch.query<{bits:string}>('SELECT toString(bitmap_col) AS bits FROM '+bitmap);if(rows[0]?.bits==='257')break;await new Promise(r=>setTimeout(r,100));}
  expect((await ch.query<{bits:string}>('SELECT toString(bitmap_col) AS bits FROM '+bitmap))[0].bits).toBe('257');
 });
 it('全量第40位与增量同步保留其他位，最新NULL撤销风险命中',async()=>{
  const high40=(BigInt(1)<<BigInt(40)).toString();
  await ch.createTable('CREATE TABLE '+syncSource+' (entity_id String,tag_value Nullable(Int8),update_time DateTime64(3)) ENGINE=MergeTree ORDER BY (entity_id,update_time)');
  await ch.createTable('CREATE TABLE '+syncBitmap+' (entity_id String,bitmap_col SimpleAggregateFunction(groupBitOr,UInt64)) ENGINE=AggregatingMergeTree ORDER BY entity_id');
  await ch.execute('INSERT INTO '+syncBitmap+" VALUES ('a',5),('b',"+(BigInt(high40)|BigInt(5)).toString()+")");
  await ch.execute('INSERT INTO '+syncSource+" VALUES ('a',1,'2026-08-01 00:00:00'),('b',1,'2026-08-01 00:00:00'),('b',NULL,'2026-08-02 00:00:00'),('c',0,'2026-08-01 00:00:00')");
  expect(await ch.syncTagBitmap({sourceTableName:syncSource,bitmapTableName:syncBitmap,bitPosition:40,incremental:false})).toEqual({affectedRows:3,syncType:'FULL'});
  const query=async()=>Object.fromEntries((await ch.query<{entity_id:string;mask:string}>('SELECT entity_id,toString(groupBitOr(bitmap_col)) AS mask FROM '+syncBitmap+' GROUP BY entity_id')).map(row=>[row.entity_id,row.mask]));
  expect(await query()).toEqual({a:(BigInt(high40)|BigInt(5)).toString(),b:'5'});
  await ch.execute('INSERT INTO '+syncSource+" VALUES ('a',NULL,'2026-09-02 00:00:00'),('b',1,'2026-09-02 00:00:00')");
  expect(await ch.syncTagBitmap({sourceTableName:syncSource,bitmapTableName:syncBitmap,bitPosition:40,incremental:true,lastSyncTime:new Date('2026-09-01T00:00:00Z')})).toEqual({affectedRows:2,syncType:'INCREMENTAL'});
  expect(await query()).toEqual({a:'5',b:(BigInt(high40)|BigInt(5)).toString()});
  await ch.syncTagBitmap({sourceTableName:syncSource,bitmapTableName:syncBitmap,bitPosition:63,incremental:false});
  expect(await query()).toEqual({a:'5',b:((BigInt(1)<<BigInt(63))|BigInt(high40)|BigInt(5)).toString()});
 });
 it('旧value和_sign_time字段在第63位增量同步中保留当前状态并移除撤销记录',async()=>{
  const high63=(BigInt(1)<<BigInt(63)).toString();
  await ch.createTable('CREATE TABLE '+signedSource+' (entity_id String,value Nullable(Int8),_sign Int8,_sign_time DateTime64(3)) ENGINE=MergeTree ORDER BY (entity_id,_sign_time)');
  await ch.execute('INSERT INTO '+signedSource+" VALUES ('d',1,1,'2026-08-01 00:00:00'),('e',1,1,'2026-08-01 00:00:00'),('e',1,-1,'2026-08-02 00:00:00')");
  await ch.execute('INSERT INTO '+syncBitmap+" VALUES ('e',"+(BigInt(high63)|BigInt(2)).toString()+")");
  expect(await ch.syncTagBitmap({sourceTableName:signedSource,bitmapTableName:syncBitmap,bitPosition:63,incremental:false})).toEqual({affectedRows:4,syncType:'FULL'});
  const query=async()=>Object.fromEntries((await ch.query<{entity_id:string;mask:string}>('SELECT entity_id,toString(groupBitOr(bitmap_col)) AS mask FROM '+syncBitmap+' GROUP BY entity_id')).map(row=>[row.entity_id,row.mask]));
  expect((await query()).d).toBe(high63);expect((await query()).e).toBe('2');
  await ch.execute('INSERT INTO '+signedSource+" VALUES ('d',1,-1,'2026-09-02 00:00:00'),('e',1,1,'2026-09-02 00:00:00')");
  expect(await ch.syncTagBitmap({sourceTableName:signedSource,bitmapTableName:syncBitmap,bitPosition:63,incremental:true,lastSyncTime:new Date('2026-09-01T00:00:00Z')})).toEqual({affectedRows:2,syncType:'INCREMENTAL'});
  expect((await query()).d).toBe('0');expect((await query()).e).toBe((BigInt(high63)|BigInt(2)).toString());expect((await query()).a).toBe('5');
 });

});

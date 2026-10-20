import {randomUUID} from 'node:crypto';
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createApiFixture,type ApiFixture} from './helpers/fixture';
import {ClickHouseClientAdapterImpl} from '@/platform/database/impl/ClickHouseClientAdapterImpl';
let f:ApiFixture;const ch=new ClickHouseClientAdapterImpl();
beforeAll(async()=>{if(!process.env.CLICKHOUSE_DATABASE?.endsWith('_test'))throw new Error('管理接口只允许测试库');f=await createApiFixture();});
afterAll(async()=>{if(f)await f.close();});
describe('位图和标签监控真实管理操作',()=>{
 it('位图表创建归属当前机构并能分配、释放高位与停用删除',async()=>{
  let bitmap:{id:string;tableName:string;ownedBy:string}|undefined;const entityTypeId=randomUUID();
  try{
   bitmap=await f.json('/api/admin/bitmap-tables','POST',{entityTypeId,entityType:'STUDENT'},201);
   expect(bitmap!.ownedBy).toBe(f.org);
   const list=await f.json('/api/admin/bitmap-tables');expect(list.items.some((v:{id:string})=>v.id===bitmap!.id)).toBe(true);const types=await f.json('/api/admin/bitmap-tables?action=entityTypes');expect(types.entityTypes.some((v:{id:string})=>v.id===entityTypeId)).toBe(true);
   const category=await f.json('/api/tag-categories','POST',{name:'API位图分类'},201),tag=await f.json('/api/tags','POST',{name:'API位图标签',categoryId:category.id,dataType:'BOOLEAN'},201);
   const assignment=await f.json('/api/admin/bitmap-tables/'+bitmap!.id+'/bits/63/assign','POST',{tagId:tag.id});expect(assignment.assignment).toMatchObject({tagId:tag.id,bitPosition:63});
   const detail=await f.json('/api/admin/bitmap-tables/'+bitmap!.id);expect(detail.usedBits).toContain(63);expect(detail.bits[63].tagId).toBe(tag.id);
   await f.json('/api/admin/bitmap-tables/'+bitmap!.id+'/bits/63/assign','DELETE');expect((await f.json('/api/admin/bitmap-tables/'+bitmap!.id)).usedBits).not.toContain(63);
   expect((await f.json('/api/admin/bitmap-tables/'+bitmap!.id+'/status','PATCH',{status:'INACTIVE'})).status).toBe('INACTIVE');
   await f.json('/api/admin/bitmap-tables/'+bitmap!.id,'DELETE');expect((await f.pool.query('SELECT is_deleted FROM bitmap_table WHERE id=$1',[bitmap!.id])).rows[0].is_deleted).toBe(true);
  }finally{if(bitmap){await ch.dropTable(bitmap.tableName);await f.pool.query('DELETE FROM bitmap_table WHERE id=$1',[bitmap.id]);}}
 });
 it('位图详情与状态更新不能访问其他机构',async()=>{
  const id=randomUUID();await f.pool.query("INSERT INTO bitmap_table(id,entity_type,entity_type_id,owned_by) VALUES ($1,'STUDENT',$2,$3)",[id,randomUUID(),f.org]);
  await f.json('/api/admin/bitmap-tables/'+id,'GET',undefined,404,'outsider');
  await f.json('/api/admin/bitmap-tables/'+id+'/status','PATCH',{status:'INACTIVE'},404,'outsider');
  expect((await f.pool.query('SELECT status FROM bitmap_table WHERE id=$1',[id])).rows[0].status).toBe('ACTIVE');
 });
 it('错误日志只展示当前机构并能真实标记解决',async()=>{
  const own=randomUUID(),other=randomUUID();
  await f.pool.query("INSERT INTO tag_refresh_log(id,tag_id,mv_name,owned_by,error_message) VALUES ($1,$2,'api_test_mv',$3,'API测试异常'),($4,$5,'api_other_mv',$6,'其他机构异常')",[own,randomUUID(),f.org,other,randomUUID(),f.otherOrg]);
  const body=await f.json('/api/admin/tag-monitor/errors');expect(body.data.some((v:{id:string})=>v.id===own)).toBe(true);expect(body.data.some((v:{id:string})=>v.id===other)).toBe(false);
  const legacy=await f.json('/api/tags/monitor/error-logs?unresolvedOnly=true');expect(legacy.some((v:{id:string})=>v.id===own)).toBe(true);expect(legacy.some((v:{id:string})=>v.id===other)).toBe(false);
  await f.json('/api/admin/tag-monitor/errors/'+own+'/resolve','POST',{});
  await f.json('/api/tags/monitor/error-logs/'+own+'/resolve','PATCH',{});expect((await f.pool.query('SELECT is_resolved FROM tag_refresh_log WHERE id=$1',[own])).rows[0].is_resolved).toBe(true);
  await f.json('/api/admin/tag-monitor/errors/'+other+'/resolve','POST',{},404);expect((await f.pool.query('SELECT is_resolved FROM tag_refresh_log WHERE id=$1',[other])).rows[0].is_resolved).toBe(false);
 });
 it('物化视图状态列表只包含当前机构标签',async()=>{
  const created:Record<string,string>={};
  for(const role of ['admin','outsider']){
   const category=await f.json('/api/tag-categories','POST',{name:'API监控状态分类-'+role},201),tag=await f.json('/api/tags','POST',{name:'API监控状态标签-'+role,categoryId:category.id,dataType:'STRING'},201),version=await f.json('/api/tags/'+tag.id+'/versions','POST',{tagId:tag.id,version:'v1'},201);
   await f.json('/api/tags/'+tag.id+'/versions/current','PUT',{versionId:version.id});
   // 由专用库夹具注入归属冲突，未登记公司不能通过应用登录或创建对象。
   if(role==='outsider'){for(const [table,id]of [['tag_category',category.id],['tag',tag.id],['tag_version',version.id]])await f.pool.query('UPDATE '+table+' SET owned_by=$2 WHERE id=$1',[id,f.otherOrg]);}
   await f.pool.query("INSERT INTO materialized_view_config(tag_id,version_id,mv_name,mv_result_table,refresh_interval,owned_by) VALUES ($1,$2,$3,$4,'REALTIME',$5)",[tag.id,version.id,'api_missing_mv_'+randomUUID().replaceAll('-',''),'api_missing_target_'+randomUUID().replaceAll('-',''),role==='admin'?f.org:f.otherOrg]);created[role]=tag.id;
  }
  const admin=await f.json('/api/admin/tag-monitor/status');expect(admin.data.some((v:{tagId:string})=>v.tagId===created.admin)).toBe(true);expect(admin.data.some((v:{tagId:string})=>v.tagId===created.outsider)).toBe(false);
  const legacy=await f.json('/api/tags/monitor');expect(legacy.some((v:{tagId:string})=>v.tagId===created.admin)).toBe(true);expect(legacy.some((v:{tagId:string})=>v.tagId===created.outsider)).toBe(false);
 });
 it('监控筛选严格拒绝非法参数',async()=>{
  await f.json('/api/admin/tag-monitor/errors?limit=0','GET',undefined,400);await f.json('/api/tags/monitor?status=invalid','GET',undefined,400);await f.json('/api/tags/monitor/error-logs?unresolvedOnly=invalid','GET',undefined,400);
 });
 it('已保存人群列表、详情及其他机构隔离读取',async()=>{
  const id=randomUUID();await f.pool.query("INSERT INTO segment(id,name,owned_by,entity_type,compute_type,status,created_by,feature) VALUES ($1,'API已保存人群',$2,'STUDENT','OFFLINE','ACTIVE',$3,'{}'::jsonb)",[id,f.org,f.users.admin.id]);
  const list=await f.json('/api/segments?name='+encodeURIComponent('API已保存人群'));expect(list.items.some((v:{id:string})=>v.id===id)).toBe(true);
  expect((await f.json('/api/segments/'+id)).name).toBe('API已保存人群');await f.json('/api/segments/'+id,'GET',undefined,404,'outsider');
  const other=await f.json('/api/segments','GET',undefined,401,'outsider');expect(other.error).toBeTruthy();
 });
});

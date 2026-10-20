import {randomUUID} from 'node:crypto';
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createApiFixture,type ApiFixture} from './helpers/fixture';
let f:ApiFixture;const table='api_cleanup_'+randomUUID().replaceAll('-','');
beforeAll(async()=>{f=await createApiFixture();});afterAll(async()=>{if(f){await f.pool.query('DROP TABLE IF EXISTS '+table);await f.close();}});
describe('账号、设置、审计与回收站',()=>{
 it('健康接口无需身份且返回合法时间与隔离标记',async()=>{const health=await f.json('/api/health','GET',undefined,200,null);expect(health.status).toBe('ok');expect(health.testMode).toBe(true);expect(Number.isFinite(Date.parse(health.timestamp))).toBe(true);});
 it('畸形JWT不能读取数据',async()=>{const response=await fetch(f.base+'/api/tags',{headers:{Authorization:'Bearer invalid-token'}});expect(response.status).toBe(401);});
 it('批量恢复和永久删除按每个对象类型实际执行',async()=>{
  const a=await f.json('/api/tag-categories','POST',{name:'API批量A'},201),b=await f.json('/api/tag-categories','POST',{name:'API批量B'},201);
  for(const item of [a,b])await f.json('/api/tag-categories/'+item.id,'DELETE');
  const ids=[a,b].map(item=>({id:item.id,type:'TAG_CATEGORY'}));
  expect((await f.json('/api/recycle-bin/batch-restore','POST',{ids})).restoredCount).toBe(2);
  for(const item of [a,b]){await f.json('/api/tag-categories/'+item.id);await f.json('/api/tag-categories/'+item.id,'DELETE');}
  expect((await f.json('/api/recycle-bin/batch','DELETE',{ids})).deletedCount).toBe(2);
  expect((await f.pool.query('SELECT COUNT(*)::int AS n FROM tag_category WHERE id=ANY($1::uuid[])',[[a.id,b.id]])).rows[0].n).toBe(0);
 });
 it('登录失败、无效参数和无凭证都明确返回错误',async()=>{
  await f.json('/api/auth/login','POST',{username:f.users.admin.username,password:'incorrect'},401,null);
  await f.json('/api/auth/login','POST',{username:''},400,null);
  await f.json('/api/auth/me','GET',undefined,401,null);
 });
 it('管理员只能列出本机构账号且不返回密码信息',async()=>{
  const body=await f.json('/api/auth/users');const users=body.users;
  expect(Array.isArray(users)).toBe(true);expect(users.some((u:{id:string})=>u.id===f.users.admin.id)).toBe(true);
  expect(users.some((u:{id:string})=>u.id===f.users.outsider.id)).toBe(false);
  expect(JSON.stringify(users)).not.toMatch(/password_hash|passwordHash|scrypt:/);
  await f.json('/api/auth/users','GET',undefined,403,'viewer');
 });
 it('部分设置更新不会重置其他配置',async()=>{
  await f.json('/api/settings','PUT',{language:'en-US',pageSize:50});
  await f.json('/api/settings','PUT',{theme:'dark'});
  expect(await f.json('/api/settings')).toMatchObject({language:'en-US',pageSize:50,theme:'dark'});
  await f.json('/api/settings','PUT',{sessionTimeout:3},400);
 });
 it('登出与设置操作真实写入本机构审计',async()=>{
  await f.json('/api/auth/logout','POST',{});
  const logs=await f.json('/api/audit-logs?page=1&pageSize=100');expect(logs.items.some((l:{actorId:string})=>l.actorId===f.users.admin.id)).toBe(true);
  const others=await f.json('/api/audit-logs','GET',undefined,401,'outsider');expect(others.error).toBeTruthy();
 });
 it('回收站恢复和永久删除真实改变记录',async()=>{
  const category=await f.json('/api/tag-categories','POST',{name:'API回收恢复'},201);
  await f.json('/api/tag-categories/'+category.id,'DELETE');
  await f.json('/api/recycle-bin/'+category.id+'/restore','POST',{type:'TAG_CATEGORY'});
  expect((await f.json('/api/tag-categories/'+category.id)).name).toBe('API回收恢复');
  await f.json('/api/tag-categories/'+category.id,'DELETE');
  await f.json('/api/recycle-bin/'+category.id+'?type=TAG_CATEGORY','DELETE');
  expect((await f.pool.query('SELECT id FROM tag_category WHERE id=$1',[category.id])).rowCount).toBe(0);
 });
 it('跨机构恢复被拒绝且不会修改删除状态',async()=>{
  const category=await f.json('/api/tag-categories','POST',{name:'API隔离回收'},201);await f.json('/api/tag-categories/'+category.id,'DELETE');
  await f.json('/api/recycle-bin/'+category.id+'/restore','POST',{type:'TAG_CATEGORY'},404,'outsider');
  expect((await f.pool.query('SELECT is_deleted FROM tag_category WHERE id=$1',[category.id])).rows[0].is_deleted).toBe(true);
 });
});
describe('仅测试库的数据库浏览器',()=>{
 it('真实列举表并拒绝非法标识',async()=>{
  const tables=await f.json('/api/admin/db-browser/tables');expect(tables.success).toBe(true);expect(Array.isArray(tables.data)).toBe(true);
  await f.json('/api/admin/db-browser/tables/local_user/preview?schema=invalid%3Bschema','GET',undefined,400);
 });
 it('预览和清空只操作本测试创建的随机表',async()=>{
  await f.pool.query('CREATE TABLE '+table+' (id int,value text)');await f.pool.query('INSERT INTO '+table+" VALUES (1,'test')");
  const preview=await f.json('/api/admin/db-browser/tables/'+table+'/preview');expect(preview.success).toBe(true);expect(preview.data.rows).toHaveLength(1);
  await f.json('/api/admin/db-browser/tables/'+table+'/truncate','POST',{},403,'viewer');
  expect((await f.pool.query('SELECT COUNT(*)::int AS n FROM '+table)).rows[0].n).toBe(1);
  await f.json('/api/admin/db-browser/tables/'+table+'/truncate','POST',{});expect((await f.pool.query('SELECT COUNT(*)::int AS n FROM '+table)).rows[0].n).toBe(0);
 });
});

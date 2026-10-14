import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createApiFixture,type ApiFixture} from './helpers/fixture';
import {randomUUID} from 'node:crypto';
import {generateTargetTableDDL,serializeDDLResult} from '@/platform/ddl';
import {TagValueType} from '@/shared/enums/tag/TagValueType';
import {entityTypes} from '@/shared/config/entity-types';
import {ClickHouseClientAdapterImpl} from '@/platform/database/impl/ClickHouseClientAdapterImpl';
let f:ApiFixture;
beforeAll(async()=>{f=await createApiFixture();});afterAll(async()=>{if(f)await f.close();});
describe('分类与标签实际CRUD',()=>{
 it.each([['activate','PUT',400],['deactivate','PUT',404],['resume','POST',404]])('不存在标签的%s操作拒绝且不会假成功',async(action,method,status)=>{await f.json('/api/tags/11111111-1111-4111-8111-111111111111/'+action,String(method),{},Number(status));});
 it('未配置规则或版本的标签无法激活',async()=>{
  const category=await f.json('/api/tag-categories','POST',{name:'API未配置分类'},201),tag=await f.json('/api/tags','POST',{name:'API未配置标签',categoryId:category.id,dataType:'STRING'},201);
  const result=await f.json('/api/tags/'+tag.id+'/activate','PUT',{},400);expect(result.error).toContain('版本');expect((await f.json('/api/tags/'+tag.id)).status).toBe('DRAFT');
 });

 it('目标表在PostgreSQL保存并于ClickHouse建表、激活、停用和软删除',async()=>{
  if(!process.env.CLICKHOUSE_DATABASE?.endsWith('_test'))throw new Error('目标表测试只允许ClickHouse测试库');
  const name='api_target_'+randomUUID().replaceAll('-',''),ch=new ClickHouseClientAdapterImpl();
  try{
   const category=await f.json('/api/tag-categories','POST',{name:'API目标表分类'},201),tag=await f.json('/api/tags','POST',{name:'API目标表标签',categoryId:category.id,dataType:'STRING'},201);
   const ddl=serializeDDLResult(generateTargetTableDDL({tableName:name,entityTypeCode:'STUDENT',entityTypeId:entityTypes[0].id,tagValueType:TagValueType.STRING}));
   const target=await f.json('/api/tags/target-tables','POST',{tableName:name,entityType:'STUDENT',entityTypeId:entityTypes[0].id,tagId:tag.id,createTableSql:ddl},201);
   expect(target.ownedBy).toBe(f.org);expect(target.status).toBe('DRAFT');
   expect((await f.json('/api/tags/target-tables/'+target.id,'PUT',{createTableSql:ddl})).createTableSql).toBe(ddl);
   expect((await f.json('/api/tags/target-tables/'+target.id+'/create-table','POST',{})).status).toBe('CREATED');expect(await ch.checkTableExists(name)).toBe(true);
   expect((await f.json('/api/tags/target-tables/'+target.id+'/activate','POST',{})).status).toBe('ACTIVE');
   expect((await f.json('/api/tags/target-tables/'+target.id+'/deactivate','POST',{})).status).toBe('INACTIVE');
   await f.json('/api/tags/'+tag.id,'DELETE');await f.json('/api/tags/target-tables/'+target.id,'DELETE');await f.json('/api/tags/target-tables/'+target.id,'GET',undefined,404);
  }finally{await ch.dropTable(name);}
 });
 it('公开目录只含已设置公开的标签，缺少机构参数明确报错',async()=>{
  const category=await f.json('/api/tag-categories','POST',{name:'API公开分类'},201),published=await f.json('/api/tags','POST',{name:'API公开标签',categoryId:category.id,dataType:'STRING',isPublic:true},201),privateTag=await f.json('/api/tags','POST',{name:'API私有标签',categoryId:category.id,dataType:'STRING'},201);
  const response=await fetch(f.base+'/api/public/tags',{headers:{'x-tenant-id':f.org}});const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);expect(body.items.some((v:{id:string})=>v.id===published.id)).toBe(true);expect(body.items.some((v:{id:string})=>v.id===privateTag.id)).toBe(false);
  await f.json('/api/public/tags','GET',undefined,400,null);
 });
 it('分类批量删除返回实际删除数量且从列表消失',async()=>{
  const ids=[];for(const name of ['API批量分类A','API批量分类B'])ids.push((await f.json('/api/tag-categories','POST',{name},201)).id);
  expect((await f.json('/api/tag-categories/batch-delete','POST',{ids})).deletedCount).toBe(2);
  for(const id of ids)await f.json('/api/tag-categories/'+id,'GET',undefined,404);
 });
 it('分类创建、父子移动、排序、修改、删除后只在回收站可见',async()=>{
  const parent=await f.json('/api/tag-categories','POST',{name:'API父分类'},201);
  const child=await f.json('/api/tag-categories','POST',{name:'API子分类'},201);
  expect((await f.pool.query('SELECT owned_by FROM tag_category WHERE id=$1',[parent.id])).rows[0].owned_by).toBe(f.org);
  await f.json('/api/tag-categories/move','POST',{categoryId:child.id,newParentId:parent.id});
  expect((await f.pool.query('SELECT parent_id FROM tag_category WHERE id=$1',[child.id])).rows[0].parent_id).toBe(parent.id);
  await f.json('/api/tag-categories/reorder','POST',{categoryIds:[child.id],orderIndex:[7]},204);
  expect((await f.json('/api/tag-categories/'+child.id)).orderIndex).toBe(7);
  await f.json('/api/tag-categories/'+child.id,'PUT',{id:child.id,name:'API改名分类'});
  expect((await f.json('/api/tag-categories/'+child.id)).name).toBe('API改名分类');
  await f.json('/api/tag-categories/'+child.id,'DELETE');
  await f.json('/api/tag-categories/'+child.id,'GET',undefined,404);
  const recycle=await f.json('/api/recycle-bin?type=TAG_CATEGORY');expect(recycle.items.some((v:{id:string})=>v.id===child.id)).toBe(true);
 });
 it('标签保存版本与当前版本并可修改和软删除',async()=>{
  const category=await f.json('/api/tag-categories','POST',{name:'API标签分类'},201);
  const tag=await f.json('/api/tags','POST',{name:'API标签',categoryId:category.id,dataType:'STRING',version:{version:'v1'}},201);
  expect(tag.ownedBy).toBe(f.org);
  const newVersion=await f.json('/api/tags/'+tag.id+'/versions','POST',{tagId:tag.id,version:'v2',description:'API新版本'},201);
  const versions=await f.json('/api/tags/'+tag.id+'/versions');expect(versions.items.some((v:{id:string})=>v.id===newVersion.id)).toBe(true);
  await f.json('/api/tags/'+tag.id+'/versions/current','PUT',{versionId:newVersion.id});
  expect((await f.json('/api/tags/'+tag.id)).currentVersion.id).toBe(newVersion.id);
  await f.json('/api/tags/'+tag.id,'PUT',{id:tag.id,categoryId:category.id,name:'API标签改名',feature:{business:'education'}});
  expect((await f.json('/api/tags/'+tag.id)).name).toBe('API标签改名');
  await f.json('/api/tags/'+tag.id,'DELETE');await f.json('/api/tags/'+tag.id,'GET',undefined,404);
 });
 it('分类列表不会泄漏其他机构创建记录',async()=>{
  const mine=await f.json('/api/tag-categories','POST',{name:'API专属分类'},201);
  await f.json('/api/tag-categories/'+mine.id,'GET',undefined,404,'outsider');
  const list=await f.json('/api/tag-categories','GET',undefined,200,'outsider');expect(list.items.some((v:{id:string})=>v.id===mine.id)).toBe(false);
 });
 it('不存在目标表的操作返回404',async()=>{
  const id='11111111-1111-4111-8111-111111111111';
  for(const action of ['create-table','activate','deactivate'])await f.json('/api/tags/target-tables/'+id+'/'+action,'POST',{},404);
 });
});

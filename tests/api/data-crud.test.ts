import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createApiFixture,type ApiFixture} from './helpers/fixture';
let f:ApiFixture;
beforeAll(async()=>{f=await createApiFixture();});afterAll(async()=>{if(f)await f.close();});
const source=(name:string)=>({name,type:'POSTGRESQL',host:'127.0.0.1',port:25432,databaseName:'education_cleanup_test',username:'postgres',password:'test_password'});
describe('数据源与数据模型实际CRUD',()=>{
 it('保存数据源、真实连通检查、启停与软删除',async()=>{
  const item=await f.json('/api/data-sources','POST',source('API测试数据源'),201);
  expect(item.ownedBy).toBe(f.org);expect(item).not.toHaveProperty('password');
  const test=await f.json('/api/data-sources/'+item.id+'/test-connection','GET');expect(test.success).toBe(true);
  await f.json('/api/data-sources/'+item.id+'/enable','POST',{});
  expect((await f.json('/api/data-sources/'+item.id)).status).toBe('ACTIVE');
  await f.json('/api/data-sources/'+item.id+'/disable','POST',{});
  expect((await f.json('/api/data-sources/'+item.id)).status).toBe('DISABLED');
  await f.json('/api/data-sources/'+item.id,'PUT',{name:'API数据源改名'});
  expect((await f.json('/api/data-sources/'+item.id)).name).toBe('API数据源改名');
  await f.json('/api/data-sources/'+item.id,'DELETE');await f.json('/api/data-sources/'+item.id,'GET',undefined,404);
 });
 it('模型及字段保存、更新、激活、停用和回收站恢复',async()=>{
  const ds=await f.json('/api/data-sources','POST',source('API模型数据源'),201);
  await f.json('/api/data-sources/'+ds.id+'/enable','POST',{});
  const model=await f.json('/api/data-models','POST',{name:'API模型',datasourceId:ds.id,tableName:'local_user',ownedBy:f.org,columns:[{name:'id',dataType:'STRING',isPrimaryKey:true,isNullable:false}]},201);
  const detail=await f.json('/api/data-models/'+model.id);expect(detail.columns).toHaveLength(1);expect(detail.columns[0].name).toBe('id');
  await f.json('/api/data-models/'+model.id,'PUT',{id:model.id,name:'API模型改名',columns:detail.columns.map((c:{id:string;name:string;dataType:string})=>({operation:'UPDATE',columnId:c.id,name:c.name,dataType:c.dataType,isPrimaryKey:true,isNullable:false}))});
  expect((await f.json('/api/data-models/'+model.id)).name).toBe('API模型改名');
  await f.json('/api/data-models/'+model.id+'/activate','PATCH',{});expect((await f.json('/api/data-models/'+model.id)).status).toBe('ACTIVE');
  await f.json('/api/data-models/'+model.id+'/deactivate','PATCH',{});expect((await f.json('/api/data-models/'+model.id)).status).toBe('INACTIVE');
  await f.json('/api/data-models/'+model.id,'DELETE');await f.json('/api/data-models/'+model.id,'GET',undefined,404);
  await f.json('/api/recycle-bin/'+model.id+'/restore','POST',{type:'DATA_MODEL'});expect((await f.json('/api/data-models/'+model.id)).columns).toHaveLength(1);
 });
 it('其他机构不能读取本机构数据源',async()=>{
  const ds=await f.json('/api/data-sources','POST',source('API机构隔离'),201);
  await f.json('/api/data-sources/'+ds.id,'GET',undefined,404,'outsider');
  const list=await f.json('/api/data-sources','GET',undefined,200,'outsider');expect(list.items.some((v:{id:string})=>v.id===ds.id)).toBe(false);
 });
});

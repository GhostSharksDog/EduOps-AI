import {randomUUID} from 'node:crypto';
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {NextRequest} from 'next/server';
import {GET as batchHandler} from '@/app/api/tags/[id]/values/route';
import {createApiFixture,type ApiFixture} from '../../api/helpers/fixture';
import {ClickHouseClientAdapterImpl} from '@/platform/database/impl/ClickHouseClientAdapterImpl';
if(!process.env.CLICKHOUSE_DATABASE?.endsWith('_test'))throw new Error('ClickHouse集成测试要求专用*_test库');
let f:ApiFixture,tagId:string;const versionId=randomUUID(),entityId=randomUUID(),missingEntity=randomUUID(),table='api_values_'+randomUUID().replaceAll('-',''),ch=new ClickHouseClientAdapterImpl();
beforeAll(async()=>{
 f=await createApiFixture();const category=await f.json('/api/tag-categories','POST',{name:'API标签值分类'},201);
 const tag=await f.json('/api/tags','POST',{name:'API标签值',dataType:'STRING',categoryId:category.id,isPublic:true},201);tagId=tag.id;
 await f.pool.query(`INSERT INTO tag_version(id,owned_by,tag_id,version,value_type,calculation_rule,is_current,created_by) VALUES ($1,$2,$3,1,'STRING','{}'::jsonb,true,$4)`,[versionId,f.org,tagId,f.users.admin.id]);
 await f.pool.query('UPDATE tag SET current_version_id=$1 WHERE id=$2',[versionId,tagId]);
 await f.pool.query(`INSERT INTO materialized_view_config(tag_id,version_id,mv_name,mv_result_table,refresh_interval,owned_by) VALUES ($1,$2,$3,$4,'REALTIME',$5)`,[tagId,versionId,table+'_mv',table,f.org]);
 await ch.createTable('CREATE TABLE '+table+' (entity_id String,tag_value String) ENGINE=MergeTree ORDER BY entity_id');
 await ch.execute('INSERT INTO '+table+" VALUES ('"+entityId+"','risk')");
});
afterAll(async()=>{await ch.dropTable(table);if(f)await f.close();});
describe('真实标签值查询HTTP和上限边界',()=>{
 it('公开标签值按机构和名称查询真实结果',async()=>{
  const headers={Authorization:'Bearer '+f.users.admin.token,'x-tenant-id':f.otherOrg};
  const response=await fetch(f.base+'/api/public/tags/values?tagId='+tagId+'&entityIds='+entityId,{headers});expect(response.status).toBe(200);expect((await response.json()).data[0]).toMatchObject({entityId,value:'risk'});
  const byName=await fetch(f.base+'/api/public/tags/values?tagName='+encodeURIComponent('API标签值')+'&entityIds='+entityId,{headers});expect(byName.status).toBe(200);expect((await byName.json()).tagId).toBe(tagId);
  expect((await fetch(f.base+'/api/public/tags/values?tagId='+tagId+'&entityIds='+entityId,{headers:{'x-tenant-id':f.org}})).status).toBe(401);
 });
 it('批量查询返回真实值而不为未知实体捏造值',async()=>{const body=await f.json('/api/tags/'+tagId+'/values?entityIds='+entityId+','+missingEntity);expect(body.data).toHaveLength(1);expect(body.data[0]).toMatchObject({entityId,value:'risk'});});
 it('单实体查询返回真实值且不存在实体返回404',async()=>{expect((await f.json('/api/tags/'+tagId+'/values/'+entityId)).data).toMatchObject({entityId,value:'risk'});await f.json('/api/tags/'+tagId+'/values/'+missingEntity,'GET',undefined,404);});
 it('指定有效版本得到相同业务值',async()=>{const body=await f.json('/api/tags/'+tagId+'/values?entityIds='+entityId+'&versionId='+versionId);expect(body.data[0].value).toBe('risk');});
 it('1000实体边界可用、1001实体严格拒绝',async()=>{
  for(const count of [1000,1001]){const request=new NextRequest(f.base+'/api/tags/'+tagId+'/values?entityIds='+Array.from({length:count},()=>entityId).join(','),{headers:{Authorization:'Bearer '+f.users.admin.token}});const response=await batchHandler(request,{params:Promise.resolve({id:tagId})});expect(response.status).toBe(count===1000?200:400);if(count===1000)expect((await response.json()).data[0].value).toBe('risk');}
 });
});

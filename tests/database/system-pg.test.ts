import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {db,queryOne,execute,transaction} from '@/platform/database';
import {RecycleBinApplicationServiceImpl} from '@/modules/system/services/recycle-bin/RecycleBinApplicationServiceImpl';
import {DatabaseSegmentRepository} from '@/modules/segment/repositories/DatabaseSegmentRepository';
import {RecycleBinItemType as Type} from '@/shared/enums';
import {getDefaultCompany} from '@/platform/company/registry';
const org=getDefaultCompany().organizationId,other=randomUUID(),actor=randomUUID(),service=new RecycleBinApplicationServiceImpl(),segments=new DatabaseSegmentRepository();
function guard(){const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test')throw Error('仅限本轮专用_test数据库');}
beforeAll(async()=>{guard();expect((await queryOne('SELECT current_database() AS name'))?.name).toBe('education_cleanup_test');});
afterAll(async()=>{guard();for(const table of ['segment_condition','segment_calculation_task','segment_member','segment','model_column','data_model','data_sources','target_table'])await execute(`DELETE FROM ${table} WHERE created_by=$1`,[actor]);await db.end();});
async function seedSegment(ownedBy=org){const id=randomUUID();await execute(`INSERT INTO segment(id,name,owned_by,entity_type,compute_type,status,created_by) VALUES($1,'回收站测试',$2,'STUDENT','MANUAL','DRAFT',$3)`,[id,ownedBy,actor]);return id;}
async function seedSource(ownedBy=org){const id=randomUUID();await execute(`INSERT INTO data_sources(id,name,type,host,port,database_name,username,password,owned_by,created_by) VALUES($1,'回收站测试','POSTGRESQL','localhost',25432,'fixture_test','fixture','fixture',$2,$3)`,[id,ownedBy,actor]);return id;}
describe('回收站真实事务与恢复语义',()=>{
 it('恢复人群只恢复本次连带删除的条件、任务和成员',async()=>{
  const id=await seedSegment(),active=randomUUID(),prior=randomUUID(),task=randomUUID(),member=randomUUID();
  await execute(`INSERT INTO segment_condition(id,owned_by,segment_id,condition_type,created_by,is_deleted,delete_time) VALUES($1,$3,$4,'TAG',$5,false,NULL),($2,$3,$4,'TAG',$5,true,NOW()-interval '1 day')`,[active,prior,org,id,actor]);
  await execute(`INSERT INTO segment_calculation_task(id,owned_by,segment_id,status,created_by) VALUES($1,$2,$3,'COMPLETED',$4)`,[task,org,id,actor]);
  await execute(`INSERT INTO segment_member(id,owned_by,segment_id,member_id,join_method,created_by) VALUES($1,$2,$3,'fixture:student','MANUAL',$4)`,[member,org,id,actor]);
  await segments.remove(id,{tenantId:org});
  await service.restoreRecycleBinItem({id,type:Type.SEGMENT,restoredBy:actor,tenantFilter:{tenantId:org}});
  for(const [table,item]of [['segment_condition',active],['segment_calculation_task',task],['segment_member',member]])expect((await queryOne(`SELECT is_deleted FROM ${table} WHERE id=$1`,[item]))?.is_deleted).toBe(false);
  expect((await queryOne('SELECT is_deleted FROM segment_condition WHERE id=$1',[prior]))?.is_deleted).toBe(true);
 });
 it('恢复模型不会复活删除前独立删除的列',async()=>{
  const source=await seedSource(),model=randomUUID(),active=randomUUID(),prior=randomUUID();
  await execute(`INSERT INTO data_model(id,name,datasource_id,owned_by,created_by) VALUES($1,'模型恢复测试',$2,$3,$4)`,[model,source,org,actor]);
  await execute(`INSERT INTO model_column(id,model_id,name,display_name,data_type,owned_by,created_by,is_deleted,delete_time) VALUES($1,$3,'active','字段','STRING',$4,$5,false,NULL),($2,$3,'prior','原已删除','STRING',$4,$5,true,NOW()-interval '1 day')`,[active,prior,model,org,actor]);
  await transaction(async client=>{await execute('UPDATE data_model SET is_deleted=true,delete_time=NOW() WHERE id=$1',[model],client);await execute('UPDATE model_column SET is_deleted=true,delete_time=NOW() WHERE id=$1',[active],client);});
  await service.restoreRecycleBinItem({id:model,type:Type.DATA_MODEL,restoredBy:actor,tenantFilter:{tenantId:org}});
  expect((await queryOne('SELECT is_deleted FROM model_column WHERE id=$1',[active]))?.is_deleted).toBe(false);
  expect((await queryOne('SELECT is_deleted FROM model_column WHERE id=$1',[prior]))?.is_deleted).toBe(true);
 });
 it('批量恢复遇到越权对象时整个事务回滚',async()=>{
  const own=await seedSegment(),foreign=await seedSegment(other);await execute('UPDATE segment SET is_deleted=true,delete_time=NOW() WHERE id=ANY($1::uuid[])',[[own,foreign]]);
  await expect(service.batchRestoreRecycleBinItems({ids:[{id:own,type:Type.SEGMENT},{id:foreign,type:Type.SEGMENT}],restoredBy:actor,tenantFilter:{tenantId:org}})).rejects.toMatchObject({statusCode:404});
  expect((await queryOne('SELECT is_deleted FROM segment WHERE id=$1',[own]))?.is_deleted).toBe(true);
 });
 it('永久删除在删除子对象前校验机构',async()=>{
  const source=await seedSource(other),model=randomUUID(),column=randomUUID();await execute(`INSERT INTO data_model(id,name,datasource_id,owned_by,created_by,is_deleted,delete_time) VALUES($1,'其他机构模型',$2,$3,$4,true,NOW())`,[model,source,other,actor]);
  await execute(`INSERT INTO model_column(id,model_id,name,data_type,owned_by,created_by) VALUES($1,$2,'field','STRING',$3,$4)`,[column,model,other,actor]);
  await expect(service.permanentlyDeleteRecycleBinItem({id:model,type:Type.DATA_MODEL,tenantFilter:{tenantId:org}})).rejects.toMatchObject({statusCode:404});
  expect((await queryOne('SELECT id FROM model_column WHERE id=$1',[column]))?.id).toBe(column);
 });
 it('目标表按实际名称过滤且分页空页保留真实总数',async()=>{
  const id=randomUUID();await execute(`INSERT INTO target_table(id,table_name,entity_type,entity_type_id,owned_by,create_table_sql,table_type,is_deleted,delete_time,created_by) VALUES($1,$2,'STUDENT',$3,$4,'{}'::jsonb,'PHYSICAL_TABLE',true,NOW(),$5)`,[id,'recycle_fixture_'+id.replaceAll('-',''),randomUUID(),org,actor]);
  const result=await service.listRecycleBinItems({type:Type.TARGET_TABLE,keyword:'recycle_fixture',page:100,pageSize:10,tenantFilter:{tenantId:org}});expect(result.items).toEqual([]);expect(result.totalCount).toBe(1);
 });
});

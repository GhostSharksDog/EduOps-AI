import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {db,execute,queryOne,queryRows} from '@/platform/database';
import {DataSource} from '@/modules/data/domain/datasource/entities/DataSource';
import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {DataSourceAdapterImpl} from '@/modules/data/repositories/DataSourceAdapterImpl';
import {DatabaseDataSourceRepository} from '@/modules/data/repositories/DatabaseDataSourceRepository';
import {DatabaseDataModelRepository} from '@/modules/data/repositories/DatabaseDataModelRepository';
import {DatabaseModelColumnRepository} from '@/modules/data/repositories/DatabaseModelColumnRepository';
import {Segment} from '@/modules/segment/domain/entities/Segment';
import {SegmentMember} from '@/modules/segment/domain/entities/SegmentMember';
import {SegmentCalculationTask} from '@/modules/segment/domain/entities/SegmentCalculationTask';
import type {SegmentConditionGroup} from '@/modules/segment/domain/value-objects/SegmentConditionGroup';
import {DatabaseSegmentRepository} from '@/modules/segment/repositories/DatabaseSegmentRepository';
import {DatabaseSegmentMemberRepository} from '@/modules/segment/repositories/DatabaseSegmentMemberRepository';
import {DatabaseSegmentCalculationTaskRepository} from '@/modules/segment/repositories/DatabaseSegmentCalculationTaskRepository';
import {ComparisonOperator,ConditionOperator,DataModelStatus,DataSourceStatus,DataSourceType,DataType,JoinMethod,SegmentCalculationType,SegmentStatus,SegmentType} from '@/shared/enums';
import {getDefaultCompany} from '@/platform/company/registry';

const organizations=[getDefaultCompany().organizationId,randomUUID()];
const [org,foreignOrg]=organizations,actor=randomUUID();
const owner={tenantId:org},foreign={tenantId:foreignOrg};
const sources=new DatabaseDataSourceRepository(new DataSourceAdapterImpl());
const models=new DatabaseDataModelRepository(),columns=new DatabaseModelColumnRepository();
const segments=new DatabaseSegmentRepository(),members=new DatabaseSegmentMemberRepository(),tasks=new DatabaseSegmentCalculationTaskRepository();
let databaseVerified=false;

function assertTestDatabase(){
 const raw=process.env.DATABASE_URL;
 if(!raw)throw new Error('必须显式配置专用测试数据库，不读取环境文件');
 const url=new URL(raw);
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test'||!url.pathname.endsWith('_test'))throw new Error('仅允许127.0.0.1:25432/education_cleanup_test，禁止业务数据库');
}
beforeAll(async()=>{
 assertTestDatabase();
 expect((await queryOne<{name:string}>('SELECT current_database() AS name'))?.name).toBe('education_cleanup_test');
 databaseVerified=true;
});
afterAll(async()=>{
 if(!databaseVerified)return;
 assertTestDatabase();
 // 只清理本测试随机机构，保留其他套件和用户数据。
 await execute('UPDATE segment_condition SET parent_id=NULL WHERE created_by=$1',[actor]);
 for(const table of ['segment_member','segment_calculation_task','segment_condition','segment','model_column','data_model','data_sources']){
  await execute('DELETE FROM '+table+' WHERE created_by=$1',[actor]);
 }
 await db.end();
});

async function sourceFixture(organization=org){
 const source=new DataSource(randomUUID(),'测试数据源_'+randomUUID(),organization,new Date(),actor);
 Object.assign(source,{type:DataSourceType.POSTGRESQL,host:'127.0.0.1',port:5432,databaseName:'synthetic_catalog',username:'fixture_user',password:'synthetic-connection-value',status:DataSourceStatus.ACTIVE,feature:{nested:{snake_key:'保持原键'}}});
 return sources.save(source,{tenantId:organization});
}
function columnFixture(modelId:string,name:string,organization=org){
 const column=new ModelColumn(randomUUID(),modelId,name,organization,new Date(),actor);
 Object.assign(column,{dataType:DataType.STRING,isNullable:true,defaultValue:null,orderIndex:0,isPrimaryKey:false});
 return column;
}
async function modelFixture(){
 const source=await sourceFixture(),id=randomUUID();
 const model=new DataModel(id,'测试数据模型_'+randomUUID(),DataModelStatus.DRAFT,source,org,new Date(),actor);
 model.columns=[columnFixture(id,'student_id'),columnFixture(id,'attendance_state')];
 return models.create(model);
}
function segmentFixture(group?:SegmentConditionGroup,organization=org){
 const segment=new Segment(randomUUID(),'测试人群_'+randomUUID(),organization,new Date(),actor);
 Object.assign(segment,{type:SegmentType.STUDENT,status:SegmentStatus.DRAFT,calculationType:SegmentCalculationType.OFFLINE,conditionGroup:group,feature:{nested:{snake_key:'不要转换JSON键'}}});
 return segment;
}
function memberFixture(segmentId:string,memberId:string,organization=org){
 return new SegmentMember(randomUUID(),segmentId,memberId,JoinMethod.MANUAL,new Date(),organization,new Date(),actor);
}

describe('pg数据源和模型仓储回归',()=>{
 it('数据源查询与更新隔离机构，JSON保持原键，软删除后列表排除并可恢复',async()=>{
  const source=await sourceFixture();
  expect((await sources.findById(source.id,owner))?.feature).toEqual({nested:{snake_key:'保持原键'}});
  expect(await sources.findById(source.id,foreign)).toBeNull();
  expect(await sources.findByName(source.name,foreign)).toBeNull();
  expect(await sources.count({name:source.name,tenantFilter:foreign})).toBe(0);
  expect(await sources.findAll({name:source.name,tenantFilter:foreign})).toEqual([]);
  source.name="更新数据源_'_"+randomUUID();source.password='';
  await expect(sources.save(source,foreign)).rejects.toThrow('access denied');
  const updated=await sources.save(source,owner);
  expect(updated.name).toBe(source.name);
  expect(updated.password).toBe('synthetic-connection-value');
  updated.delete(actor);await sources.save(updated,owner);
  expect(await sources.findById(source.id,owner)).toBeNull();
  expect(await sources.count({name:source.name,tenantFilter:owner})).toBe(0);
  expect((await queryOne<{is_deleted:boolean;delete_time:Date}>('SELECT is_deleted,delete_time FROM data_sources WHERE id=$1 AND owned_by=$2',[source.id,org]))?.is_deleted).toBe(true);
  updated.restore();await sources.save(updated,owner);
  expect((await sources.findById(source.id,owner))?.id).toBe(source.id);
 });

 it('数据模型关联数据源和列，读取、更新及独立列操作均限制机构',async()=>{
  const model=await modelFixture();
  expect(model.datasource.name).toMatch(/^测试数据源_/);
  expect(model.columns.map(c=>c.name).sort()).toEqual(['attendance_state','student_id']);
  expect(await models.findById(model.id,foreign)).toBeNull();
  expect(await models.findByName(model.name,foreign)).toBeNull();
  expect(await models.count({name:model.name,tenantFilter:foreign} as Parameters<typeof models.count>[0])).toBe(0);
  expect(await models.findAll({name:model.name,tenantFilter:foreign})).toEqual([]);
  model.name='更新模型_'+randomUUID();
  await expect(models.update(model,foreign)).rejects.toThrow('access denied');
  expect((await models.update(model,owner)).name).toBe(model.name);
  const extra=columnFixture(model.id,'learning_stage');
  await expect(columns.create(extra,foreign)).rejects.toThrow('access denied');
  await columns.create(extra,owner);
  expect(await columns.findById(extra.id,foreign)).toBeNull();
  expect(await columns.findByModelId(model.id,foreign)).toEqual([]);
  extra.name='stage_after_update';
  await expect(columns.update(extra,foreign)).rejects.toThrow('access denied');
  expect((await columns.update(extra,owner)).name).toBe('stage_after_update');
  await expect(columns.delete(extra.id,foreign)).rejects.toThrow('access denied');
  await columns.delete(extra.id,owner);
  expect(await columns.findById(extra.id,owner)).toBeNull();
 });

 it('模型列差异更新软删除，编辑加载已删列并按原ID恢复，不新增重复列',async()=>{
  const model=await modelFixture(),removedId=model.columns[1].id;
  model.removeColumn(removedId);model.updatedBy=actor;
  expect((await models.update(model,owner)).columns).toHaveLength(1);
  const deleted=await queryOne<{is_deleted:boolean;delete_time:Date;deleted_by:string}>('SELECT is_deleted,delete_time,deleted_by FROM model_column WHERE id=$1 AND owned_by=$2',[removedId,org]);
  expect(deleted?.is_deleted).toBe(true);expect(deleted?.delete_time).toBeInstanceOf(Date);expect(deleted?.deleted_by).toBe(actor);
  const editable=await models.findByIdForUpdate(model.id,owner);
  expect(editable?.columns).toHaveLength(2);
  const restored=editable!.columns.find(c=>c.id===removedId)!;
  expect(restored.isDeleted).toBe(true);restored.isDeleted=false;restored.updatedBy=actor;
  expect((await models.update(editable!,owner)).columns.map(c=>c.id).sort()).toEqual(model.columns.map(c=>c.id).concat(removedId).sort());
  const row=await queryOne<{is_deleted:boolean;delete_time:Date|null;deleted_by:string|null}>('SELECT is_deleted,delete_time,deleted_by FROM model_column WHERE id=$1 AND owned_by=$2',[removedId,org]);
  expect(row).toEqual({is_deleted:false,delete_time:null,deleted_by:null});
  expect(Number((await queryOne<{count:string}>('SELECT count(*) AS count FROM model_column WHERE model_id=$1 AND owned_by=$2',[model.id,org]))?.count)).toBe(2);
  editable!.delete(actor);await models.update(editable!,owner);
  expect(await models.findById(model.id,owner)).toBeNull();
  expect(await models.findAll({name:editable!.name,tenantFilter:owner})).toEqual([]);
 });

 it('建模列冲突时整个创建事务回滚，没有孤立主表或半批列',async()=>{
  const source=await sourceFixture(),id=randomUUID(),model=new DataModel(id,'回滚模型_'+randomUUID(),DataModelStatus.DRAFT,source,org,new Date(),actor);
  model.columns=[columnFixture(id,'same_name'),columnFixture(id,'same_name')];
  await expect(models.create(model)).rejects.toThrow();
  expect(await queryOne('SELECT id FROM data_model WHERE id=$1 AND owned_by=$2',[id,org])).toBeNull();
  expect(await queryRows('SELECT id FROM model_column WHERE model_id=$1 AND owned_by=$2',[id,org])).toEqual([]);
 });
});

describe('pg人群、条件和成员仓储回归',()=>{
 it('条件树保存与替换保留类型化值，查询及写入限制机构',async()=>{
  const firstTag=randomUUID(),nestedTag=randomUUID();
  const group:SegmentConditionGroup={operator:ConditionOperator.AND,conditions:[{id:randomUUID(),tagId:firstTag,operator:ComparisonOperator.GREATER_THAN_EQUAL,value:3,valueType:'number'},{operator:ConditionOperator.OR,conditions:[{id:randomUUID(),tagId:nestedTag,operator:ComparisonOperator.IN,value:['缺勤','请假'],valueType:'array'}]}]};
  const segment=segmentFixture(group);await segments.save(segment);
  const stored=await segments.findById(segment.id,owner);
  expect(stored?.feature).toEqual({nested:{snake_key:'不要转换JSON键'}});
  const condition=stored?.conditionGroup?.conditions.find(c=>'tagId'in c&&c.tagId===firstTag);
  expect(condition&&'value'in condition?condition.value:null).toBe(3);
  const nested=stored?.conditionGroup?.conditions.find(c=>'conditions'in c);
  expect(nested&&'conditions'in nested?nested.conditions[0]:null).toMatchObject({tagId:nestedTag,value:['缺勤','请假']});
  expect(await segments.findById(segment.id,foreign)).toBeNull();
  expect(await segments.findByName(segment.name,foreign)).toBeNull();
  expect((await segments.findAll({name:segment.name,ownedBy:foreignOrg,tenantFilter:foreign})).items).toEqual([]);
  const forged=segmentFixture(undefined,foreignOrg);forged.id=segment.id;
  await expect(segments.save(forged)).rejects.toThrow('access denied');
  segment.name='替换规则人群_'+randomUUID();
  segment.conditionGroup={operator:ConditionOperator.AND,conditions:[{id:randomUUID(),tagId:firstTag,operator:ComparisonOperator.EQUAL,value:true,valueType:'boolean'}]};
  await segments.save(segment);
  expect((await segments.findById(segment.id,owner))?.name).toBe(segment.name);
  const rows=await queryRows<{field_value:unknown}>('SELECT field_value FROM segment_condition WHERE segment_id=$1 AND owned_by=$2 ORDER BY condition_type',[segment.id,org]);
  expect(rows).toHaveLength(2);expect(rows.some(r=>r.field_value===true)).toBe(true);
 });

 it('成员写入幂等、查询和清理隔离机构；人群软删除关联条件及任务',async()=>{
  const group:SegmentConditionGroup={operator:ConditionOperator.AND,conditions:[]},segment=segmentFixture(group);
  await segments.save(segment);
  const member=memberFixture(segment.id,'synthetic:'+randomUUID());
  await members.saveMembers(segment.id,[member,member],owner);
  expect(await members.countMembers(segment.id,owner)).toBe(1);
  expect(await members.isMember(segment.id,member.memberId,owner)).toBe(true);
  expect((await members.findMembers(segment.id,{},owner)).items[0].memberId).toBe(member.memberId);
  expect(await members.countMembers(segment.id,foreign)).toBe(0);
  expect(await members.isMember(segment.id,member.memberId,foreign)).toBe(false);
  expect((await members.findMembers(segment.id,{},foreign)).items).toEqual([]);
  await expect(members.clearMembers(segment.id,foreign)).rejects.toThrow('access denied');
  await expect(members.saveMembers(segment.id,[memberFixture(segment.id,'foreign:'+randomUUID(),foreignOrg)],foreign)).rejects.toThrow('access denied');
  expect(await members.countMembers(segment.id,owner)).toBe(1);
  await members.clearMembers(segment.id,owner);
  expect(await members.countMembers(segment.id,owner)).toBe(0);
  const task=new SegmentCalculationTask(segment.id,'成员快照核验',org,actor);
  await tasks.save(task);task.complete(0);await tasks.save(task);
  expect((await tasks.findById(task.id))?.status).toBe('COMPLETED');
  await expect(segments.remove(segment.id,foreign)).rejects.toThrow('access denied');
  await segments.remove(segment.id,owner);
  expect(await segments.findById(segment.id,owner)).toBeNull();
  expect((await segments.findAll({name:segment.name,ownedBy:org,tenantFilter:owner})).items).toEqual([]);
  expect((await queryRows<{is_deleted:boolean}>('SELECT is_deleted FROM segment_condition WHERE segment_id=$1 AND owned_by=$2',[segment.id,org])).every(r=>r.is_deleted)).toBe(true);
  expect((await queryOne<{is_deleted:boolean}>('SELECT is_deleted FROM segment_calculation_task WHERE id=$1 AND owned_by=$2',[task.id,org]))?.is_deleted).toBe(true);
  expect(await tasks.findById(task.id)).toBeNull();
 });
});

import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {db,queryRows,execute} from '@/platform/database';
import {DatabaseKnowledgeRepository} from '@/modules/knowledge/repositories/repository';
import {KnowledgeApplicationService} from '@/modules/knowledge/services/service';
import type {KnowledgeEmbeddingPort} from '@/modules/knowledge/domain/ports';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
const organizationId=randomUUID(),otherOrg=randomUUID(),actorId=randomUUID();
const config={configured:true,model:'knowledge-test-model',fingerprint:'knowledge-test-config'};
let dimensions=2,fail=false;
const embeddings:KnowledgeEmbeddingPort={configuration:()=>config,embed:async texts=>{if(fail)throw new Error('fixture failure');return texts.map(()=>dimensions===2?[1,0]:[1,0,0]);}};
const repository=new DatabaseKnowledgeRepository(),service=new KnowledgeApplicationService(repository,embeddings);
const scope:AuthorizedScope={organizationId,authorizedCampusIds:[],startDate:'2026-09-01',endDate:'2026-09-30',campusIds:[],courseIds:[],channelIds:[]};
function assertTestDatabase(){if(!process.env.DATABASE_URL||!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('禁止使用业务数据库');}
beforeAll(async()=>{assertTestDatabase();await queryRows("SELECT '[1,0]'::vector <=> '[1,0]'::vector AS distance");});
afterAll(async()=>{assertTestDatabase();await execute('DELETE FROM knowledge_chunk WHERE "organizationId"=ANY($1::uuid[])',[[organizationId,otherOrg]]);await execute('DELETE FROM knowledge_source_version WHERE "organizationId"=ANY($1::uuid[])',[[organizationId,otherOrg]]);await db.end();});
describe('真实pgvector知识版本与范围',()=>{
 it('草稿不可检索；审核成功引用具体版本，机构隔离；已审核不可修改',async()=>{
  const source=await service.create({title:'出勤口径',kind:'definition',content:'应出勤包含课程当天有效报名学员，请假单独记录。',evidence:[]},organizationId,actorId);
  expect((await service.search('出勤',scope)).data?.hits).toEqual([]);
  const approved=await service.approveAndIndex(source.id,organizationId,actorId,{expectedVersion:1,expectedContentHash:source.contentHash});expect(approved.status).toBe('ready');
  const hits=(await service.search('出勤',scope)).data?.hits??[];expect(hits.some(h=>h.sourceId===source.id&&h.version==='1'&&h.text.includes('有效报名'))).toBe(true);
  expect((await service.search('出勤',{...scope,organizationId:otherOrg})).data?.hits).toEqual([]);await expect(service.get(source.id,otherOrg)).rejects.toThrow('无权');
  await expect(service.revise(source.id,organizationId,{title:source.title,content:'篡改',expectedContentHash:source.contentHash})).rejects.toThrow('不能直接编辑');
 });
 it('新版失败旧版仍可检索；重试原子切换，旧引用仍可读取',async()=>{
  const original=(await service.list(organizationId)).find(s=>s.title==='出勤口径')!;
  const next=await service.create({title:original.title,kind:original.kind,content:'新版出勤口径：取消课程不进入统计。',evidence:[],logicalSourceId:original.logicalSourceId,expectedVersion:1},organizationId,actorId);
  const approval={expectedVersion:2,expectedContentHash:next.contentHash};fail=true;expect((await service.approveAndIndex(next.id,organizationId,actorId,approval)).status).toBe('error');fail=false;
  expect((await service.search('出勤',scope)).data?.hits.some(h=>h.sourceId===original.id)).toBe(true);
  expect((await service.approveAndIndex(next.id,organizationId,actorId,approval)).status).toBe('ready');const hits=(await service.search('出勤',scope)).data?.hits??[];expect(hits.some(h=>h.sourceId===next.id)).toBe(true);expect(hits.some(h=>h.sourceId===original.id)).toBe(false);expect((await service.get(original.id,organizationId)).status).toBe('superseded');
 });
 it('多种维数共存时查询先过滤维数，不发生跨维数distance错误',async()=>{
  dimensions=3;const source=await service.create({title:'三维口径',kind:'procedure',content:'三维索引测试知识。',evidence:[]},organizationId,actorId);expect((await service.approveAndIndex(source.id,organizationId,actorId,{expectedVersion:1,expectedContentHash:source.contentHash})).status).toBe('ready');expect((await service.search('三维',scope)).data?.hits.every(h=>h.sourceId===source.id)).toBe(true);dimensions=2;expect((await service.search('二维',scope)).status).toBe('ready');
 });
 it('配置变化需要重建索引；分析摘要默认排除且仅完整周期可见',async()=>{
  const source=await service.create({title:'模拟历史摘要',kind:'analysis_snapshot',content:'模拟历史摘要：该周期签到尚需核实，不代表当前经营数字。',period:{startDate:scope.startDate,endDate:scope.endDate},dataCutoff:'2026-09-30T10:00:00.000Z',evidence:[{id:'test-metric',kind:'metric',sourceId:'test-metric',version:'1',summary:'模拟指标查询依据',updatedAt:'2026-09-30T10:00:00.000Z'}]},organizationId,actorId);
  expect((await service.approveAndIndex(source.id,organizationId,actorId,{expectedVersion:1,expectedContentHash:source.contentHash})).status).toBe('ready');expect((await service.search('摘要',scope)).data?.hits.some(h=>h.sourceId===source.id)).toBe(false);expect((await service.search('摘要',scope,{includeSnapshots:true})).data?.hits.some(h=>h.sourceId===source.id)).toBe(true);expect((await service.search('摘要',{...scope,startDate:'2026-09-02'},{includeSnapshots:true})).data?.hits.some(h=>h.sourceId===source.id)).toBe(false);
  config.fingerprint='new-test-config';expect((await service.search('出勤',scope)).data?.hits).toEqual([]);expect((await service.getCapability(organizationId)).data?.needsReindex).toBeGreaterThan(0);
 });
 it('不同版本并行准备时旧请求不能覆盖已完成的新版本',async()=>{
  const old=await service.create({title:'并发版本',kind:'procedure',content:'先前核查流程',evidence:[]},organizationId,actorId);const next=await service.create({title:old.title,kind:old.kind,content:'更新核查流程',evidence:[],logicalSourceId:old.logicalSourceId,expectedVersion:1},organizationId,actorId);
  const earlier=await repository.claimIndex(old.id,organizationId,actorId,1,old.contentHash,config),later=await repository.claimIndex(next.id,organizationId,actorId,2,next.contentHash,config);
  await repository.completeIndex(later,['更新核查流程'],[[1,0]],config);const outdated=await repository.completeIndex(earlier,['先前核查流程'],[[1,0]],config);expect(outdated.status).toBe('superseded');expect(outdated.isCurrent).toBe(false);expect((await service.get(next.id,organizationId)).isCurrent).toBe(true);
 });
 it('同版准备互斥；超时重试后旧attempt不能提交或覆盖状态',async()=>{
  const source=await service.create({title:'索引重试',kind:'definition',content:'检查超时后重试',evidence:[]},organizationId,actorId);const first=await repository.claimIndex(source.id,organizationId,actorId,1,source.contentHash,config);await expect(repository.claimIndex(source.id,organizationId,actorId,1,source.contentHash,config)).rejects.toThrow('正在准备');
  await execute('UPDATE knowledge_source_version SET "updatedAt"=$2 WHERE id=$1::uuid',[source.id,new Date(Date.now()-121000)]);const retry=await repository.claimIndex(source.id,organizationId,actorId,1,source.contentHash,config);await expect(repository.completeIndex(first,['旧请求'],[[1,0]],config)).rejects.toThrow('已失效');await repository.failIndex(first,'旧请求失败');expect((await service.get(source.id,organizationId)).indexStatus).toBe('indexing');expect((await repository.completeIndex(retry,['重试请求'],[[1,0]],config)).isCurrent).toBe(true);
 });
});



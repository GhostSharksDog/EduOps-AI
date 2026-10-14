import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {KnowledgeApplicationService,contentHash} from '@/modules/knowledge/services/service';
import {chunkKnowledgeText} from '@/modules/knowledge/domain/chunking';
import type {KnowledgeRepository,KnowledgeStoredSource,KnowledgeEmbeddingPort} from '@/modules/knowledge/domain/ports';
import {approveKnowledgeSourceSchema,createKnowledgeSourceSchema,searchKnowledgeSchema} from '@/modules/knowledge/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
const org=randomUUID(),id=randomUUID(),actor=randomUUID();
const scope:AuthorizedScope={organizationId:org,authorizedCampusIds:[],startDate:'2026-09-01',endDate:'2026-09-30',campusIds:[],courseIds:[],channelIds:[]};
function setup(configured=true){
 const source:KnowledgeStoredSource={id,logicalSourceId:randomUUID(),organizationId:org,version:'1',title:'出勤口径',kind:'definition',content:'有效课程实际出勤人次除以应出勤人次。',contentHash:contentHash('有效课程实际出勤人次除以应出勤人次。'),status:'draft',isCurrent:false,indexStatus:'pending',embeddingModel:null,embeddingDimensions:null,embeddingConfigFingerprint:null,indexAttemptId:null,updatedAt:'2026-10-09T00:00:00.000Z',createdAt:'2026-10-09T00:00:00.000Z',approvedAt:null,indexedAt:null,evidence:[],error:null};
 const repository:KnowledgeRepository={list:vi.fn(async()=>[source]),get:vi.fn(async()=>source),create:vi.fn(async()=>source),revise:vi.fn(async()=>source),claimIndex:vi.fn(async()=>({source,attemptId:randomUUID()})),completeIndex:vi.fn(async()=>({...source,status:'approved',isCurrent:true,indexStatus:'ready',embeddingDimensions:2})),failIndex:vi.fn(async()=>{}),search:vi.fn(async()=>[])};
 const embeddings:KnowledgeEmbeddingPort={configuration:()=>({configured,model:'test-embed',fingerprint:'test-config'}),embed:vi.fn(async texts=>texts.map(()=>[1,0]))};
 return {source,repository,embeddings,service:new KnowledgeApplicationService(repository,embeddings)};
}
describe('知识契约与切块',()=>{
 it('拒绝客户端机构、超长正文、反向日期和不完整摘要',()=>{
  expect(createKnowledgeSourceSchema.safeParse({title:'a',kind:'definition',content:'b',organizationId:org}).success).toBe(false);
  expect(createKnowledgeSourceSchema.safeParse({title:'a',kind:'definition',content:'a'.repeat(20001)}).success).toBe(false);
  expect(createKnowledgeSourceSchema.safeParse({title:'a',kind:'analysis_snapshot',content:'b',period:{startDate:'2026-10-02',endDate:'2026-10-01'}}).success).toBe(false);
  expect(createKnowledgeSourceSchema.safeParse({title:'a',kind:'definition',content:'b',logicalSourceId:id}).success).toBe(false);
  expect(searchKnowledgeSchema.safeParse({query:'q',scope:{...scope}}).success).toBe(false);
  expect(approveKnowledgeSourceSchema.safeParse({expectedVersion:1,expectedContentHash:'fake'}).success).toBe(false);
 });
 it('切块确定、正文有重叠且不存在空块',()=>{const text='出勤率说明\n'+('A'.repeat(700)+'\n').repeat(4);const chunks=chunkKnowledgeText(text);expect(chunks).toEqual(chunkKnowledgeText(text));expect(chunks.length).toBeGreaterThan(1);expect(chunks.every(s=>s.length>0&&s.length<=1000)).toBe(true);expect(chunks[1].startsWith(chunks[0].slice(-120))).toBe(true);expect(chunkKnowledgeText('  ')).toEqual([]);});
 it('拒绝会造成不前进的切块配置',()=>{expect(()=>chunkKnowledgeText('test',100,100)).toThrow();});
});
describe('知识应用服务',()=>{
 it('未配置时可管理来源，但不批准或调用模型',async()=>{const {service,repository,embeddings,source}=setup(false);expect((await service.getCapability(org)).status).toBe('unconfigured');expect((await service.list(org)).length).toBe(1);expect((await service.search('出勤率',scope)).status).toBe('unconfigured');expect((await service.approveAndIndex(id,org,actor,{expectedVersion:1,expectedContentHash:source.contentHash})).status).toBe('unconfigured');expect(repository.claimIndex).not.toHaveBeenCalled();expect(embeddings.embed).not.toHaveBeenCalled();});
 it('审核必须绑定正文哈希和版本，旧版本不能重审',async()=>{const {service,source,repository}=setup();await expect(service.approveAndIndex(id,org,actor,{expectedVersion:2,expectedContentHash:source.contentHash})).rejects.toThrow('已变化');await expect(service.approveAndIndex(id,org,actor,{expectedVersion:1,expectedContentHash:'0'.repeat(64)})).rejects.toThrow('已变化');source.status='superseded';await expect(service.approveAndIndex(id,org,actor,{expectedVersion:1,expectedContentHash:source.contentHash})).rejects.toThrow('旧版本');expect(repository.claimIndex).not.toHaveBeenCalled();});
 it('真实向量成功后才提交索引，外部调用错误不泄露敏感文本',async()=>{const {service,source,repository,embeddings}=setup();const input={expectedVersion:1,expectedContentHash:source.contentHash};expect((await service.approveAndIndex(id,org,actor,input)).data?.isCurrent).toBe(true);expect(repository.completeIndex).toHaveBeenCalledOnce();vi.mocked(embeddings.embed).mockRejectedValueOnce(new Error('secret-provider-token'));const failed=await service.approveAndIndex(id,org,actor,input);expect(failed.status).toBe('error');expect(JSON.stringify(failed)).not.toContain('secret-provider-token');expect(repository.failIndex).toHaveBeenCalledOnce();});
 it('拒绝错维、数量错误、零向量和非有限值',async()=>{for(const vectors of [[[1,0],[1,0]],[[0,0]],[[NaN,1]],[]]){const {service,source,repository,embeddings}=setup();vi.mocked(embeddings.embed).mockResolvedValueOnce(vectors);expect((await service.approveAndIndex(id,org,actor,{expectedVersion:1,expectedContentHash:source.contentHash})).status).toBe('error');expect(repository.completeIndex).not.toHaveBeenCalled();}});
 it('不同知识块必须有相同向量维数，标题变化也改变审核指纹',async()=>{const {service,source,repository,embeddings}=setup();source.content='出'.repeat(1300);source.contentHash=contentHash(source.content);vi.mocked(embeddings.embed).mockResolvedValueOnce([[1,0],[1,0,0]]);expect((await service.approveAndIndex(id,org,actor,{expectedVersion:1,expectedContentHash:source.contentHash})).status).toBe('error');expect(repository.completeIndex).not.toHaveBeenCalled();await service.create({title:'标题1',kind:'definition',content:'正文',evidence:[]},org,actor);await service.create({title:'标题2',kind:'definition',content:'正文',evidence:[]},org,actor);const calls=vi.mocked(repository.create).mock.calls;expect(calls[0][3]).not.toBe(calls[1][3]);});
 it('已就绪的相同版本审核幂等，不重复计费',async()=>{const {service,source,embeddings}=setup();Object.assign(source,{status:'approved',indexStatus:'ready',isCurrent:true,embeddingConfigFingerprint:'test-config'});expect((await service.approveAndIndex(id,org,actor,{expectedVersion:1,expectedContentHash:source.contentHash})).status).toBe('ready');expect(embeddings.embed).not.toHaveBeenCalled();});
 it('检索默认top5且无命中不是失败，透传授权范围',async()=>{const {service,repository}=setup();const result=await service.search('  出勤率  ',scope);expect(result).toMatchObject({status:'ready',data:{query:'出勤率',hits:[]}});expect(repository.search).toHaveBeenCalledWith([1,0],scope,{configured:true,model:'test-embed',fingerprint:'test-config'},expect.objectContaining({limit:5,includeSnapshots:false}));});
 it('撤销调用不会继续访问模型和知识库',async()=>{const {service,repository,embeddings}=setup();const controller=new AbortController();controller.abort();expect((await service.search('出勤率',scope,{signal:controller.signal})).status).toBe('error');expect(embeddings.embed).not.toHaveBeenCalled();expect(repository.search).not.toHaveBeenCalled();});
 it('返回公共来源时不携带内部索引attempt和配置指纹',async()=>{const {service}=setup();const result=await service.get(id,org);expect(result).not.toHaveProperty('indexAttemptId');expect(result).not.toHaveProperty('embeddingConfigFingerprint');});
});

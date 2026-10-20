import 'server-only';
import {createHash} from 'node:crypto';
import {educationData} from '@/modules/education/server';
import {datasetAnalysisType} from '@/modules/education/contracts';
import {decisionEvidenceStamp} from '@/modules/decision/server';
import {reportEvidenceStamp} from '@/modules/report/server';
import {alertEvidenceStamp} from '@/modules/alert/server';
import {knowledgeService} from '@/modules/knowledge/server';
import {sourceFingerprint} from '@/modules/tag/server';
import type {AgentActor,AgentTurnContext} from '../contracts';
import type {EvidenceReference} from '@/shared/contracts/analysis';
import {AgentError} from '../domain/errors';

/** 导入批次及可变业务目录均纳入指纹，解释旧结果前不重新计算经营指标。 */
export async function agentEvidenceFingerprint(actor:AgentActor,context:AgentTurnContext):Promise<string>{
 const {dataset,batches}=await educationData.inspect(actor.organizationId,context.datasetId);
 if(batches.some(b=>['running','validating'].includes(b.status)))throw new AgentError('BATCH_CHANGED','数据正在导入，请完成后重新查询',409);
 const values:unknown[]=[dataset.id,dataset.schemaVersion,dataset.dataCutoff,sourceFingerprint(dataset.id,batches)];
 if(datasetAnalysisType(dataset)==='finance'){
  const snapshot=await educationData.snapshot(actor.organizationId,dataset.id,['finance_annual']);
  values.push(snapshot.records.map(r=>[r.sourceId,r.hash]).sort());
 }
 const stamps=await Promise.all([decisionEvidenceStamp(actor.organizationId,dataset.id),reportEvidenceStamp(actor.organizationId,dataset.id),alertEvidenceStamp(actor.organizationId,dataset.id)]);
 return createHash('sha256').update(JSON.stringify([...values,...stamps])).digest('hex');
}

export async function validateAgentKnowledge(actor:AgentActor,evidence:EvidenceReference[]):Promise<void>{
 const sources=[...new Map(evidence.filter(e=>e.kind==='knowledge').map(e=>[e.sourceId+':'+e.version,e])).values()];
 for(const reference of sources){
  const source=await knowledgeService.get(reference.sourceId,actor.organizationId);
  if(String(source.version)!==reference.version||!['approved','superseded'].includes(source.status))throw new AgentError('KNOWLEDGE_CHANGED','原知识依据已不可核查，请重新查询',409);
 }
}

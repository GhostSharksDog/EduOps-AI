import 'server-only';
import {educationData} from '@/modules/education/server';
import {datasetAnalysisType} from '@/modules/education/contracts';
import {agentService} from '@/modules/agent/server';
import type {AgentActor} from '@/modules/agent/contracts';
import {riskTags} from '@/modules/tag/server';
import {previewExpiry} from '@/modules/tag/contracts';
import {riskSegments} from '@/modules/segment/server';
import {reportService} from '@/modules/report/server';
import {decisionService} from '@/modules/decision/server';
import {knowledgeService} from '@/modules/knowledge/server';
import {isFinanceScope,isLearningScope} from '@/shared/contracts/analysis';
import {sameAnalysisRange} from '@/shared/lib/analysis-navigation';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {JourneyQuery,JourneyVO} from '../contracts/journey';

/** 仅核验保存对象；查看进度不触发计算、模型或状态写入。 */
export async function queryJourney(input:JourneyQuery,actor:AgentActor):Promise<JourneyVO>{
 const org=actor.organizationId,inspection=await educationData.inspect(org,input.datasetId);
 if(datasetAnalysisType(inspection.dataset)!=='operations')throw new WorkflowError('标签人群流程仅适用于经营数据',400);
 const result:JourneyVO={ready:Array(8).fill(false),records:{},reports:[],blockers:[],warnings:[]};
 const matches=(id:string,scope:unknown)=>id===input.datasetId&&!!scope&&!isFinanceScope(scope as never)&&!isLearningScope(scope as never)&&sameAnalysisRange(scope as JourneyQuery['scope'],input.scope);
 const ids={...input};
 let task:Awaited<ReturnType<typeof decisionService.get>>|undefined;
 if(ids.taskId){task=await decisionService.get(actor,ids.taskId);if(!matches(task.datasetId,task.sourceSnapshot.scope))throw new WorkflowError('任务不属于当前分析范围',409,'SCOPE_MISMATCH');
  result.records.taskId=task.id;ids.snapshotId??=task.segmentSnapshotId??undefined;if(task.source.kind==='agent')ids.runId??=task.source.id;else ids.reportId??=task.source.id;
 }
 const snapshot=ids.snapshotId?(await riskSegments.page(org,ids.snapshotId,{page:1,pageSize:1})).snapshot:undefined;
 if(snapshot){if(!matches(snapshot.datasetId,snapshot.preview.scope))throw new WorkflowError('人群不属于当前分析范围',409,'SCOPE_MISMATCH');result.records.snapshotId=snapshot.id;
  if(!ids.proposalId){const proposals=await riskTags.list(org);ids.proposalId=proposals.find(p=>p.publishedTagId===snapshot.sourceTagId&&p.version===snapshot.tagVersion)?.id;}
 }
 if(ids.proposalId&&!ids.runId)ids.runId=(await agentService.findSavedRunForProposal(actor,ids.proposalId))?.run.id;
 const stored=ids.runId?await agentService.getSavedRun(actor,ids.runId):undefined;
 if(stored){if(!matches(stored.session.datasetId,stored.session.scope))throw new WorkflowError('会话不属于当前分析范围',409,'SCOPE_MISMATCH');result.records.runId=stored.run.id;result.records.sessionId=stored.session.id;result.ready[1]=!!stored.run.answer&&stored.run.steps.some(s=>s.status==='completed');
  if(!ids.proposalId&&stored.run.proposals.length===1)ids.proposalId=stored.run.proposals[0].id;
 }
 const proposal=ids.proposalId?await riskTags.get(org,ids.proposalId):undefined;
 if(proposal){if(!matches(proposal.datasetId,proposal.preview?.scope??proposal.scope))throw new WorkflowError('标签不属于当前分析范围',409,'SCOPE_MISMATCH');
  if(stored&&!stored.run.proposals.some(p=>p.id===proposal.id))throw new WorkflowError('标签与选定分析没有关联',409,'JOURNEY_MISMATCH');
  result.records.proposalId=proposal.id;result.ready[2]=true;result.ready[3]=!!proposal.preview&&(proposal.status==='published'||Date.now()<Date.parse(previewExpiry(proposal.preview)));result.ready[4]=proposal.status==='published';
  if(stored?.run.proposals.some(p=>p.id===proposal.id&&p.version!==proposal.version))result.warnings.push('规则已在工作台修改，请以当前保存版本为准。');
  if(snapshot&&(proposal.publishedTagId!==snapshot.sourceTagId||proposal.version!==snapshot.tagVersion))throw new WorkflowError('人群与选定标签版本没有关联',409,'JOURNEY_MISMATCH');
  if(!snapshot&&proposal.publishedTagId){const rows=await riskSegments.summaries(org,{sourceTagId:proposal.publishedTagId,tagVersion:proposal.version,datasetId:input.datasetId,scope:input.scope});if(rows.length===1){result.records.snapshotId=rows[0].id;result.ready[5]=true;}}
 }
 if(snapshot)result.ready[5]=true;
 const reports=await reportService.listFrozen(org);result.reports=reports.filter(r=>r.status==='completed'&&matches(r.datasetId,r.snapshot.scope)).map(r=>({id:r.id,label:(r.kind==='monthly'?'月报':'周报')+' · '+r.snapshot.scope.startDate+' 至 '+r.snapshot.scope.endDate+' · '+r.createdAt.slice(0,16).replace('T',' ')}));
 if(ids.reportId){const report=await reportService.getFrozen(org,ids.reportId);if(!matches(report.datasetId,report.snapshot.scope))throw new WorkflowError('报告不属于当前分析范围',409,'SCOPE_MISMATCH');result.records.reportId=report.id;result.ready[6]=report.status==='completed';}
 if(task){if(task.segmentSnapshotId&&result.records.snapshotId!==task.segmentSnapshotId)throw new WorkflowError('任务与选定人群没有关联',409,'JOURNEY_MISMATCH');
  if(task.source.kind==='agent'?task.source.id!==result.records.runId:task.source.id!==result.records.reportId)throw new WorkflowError('任务与选定分析没有关联',409,'JOURNEY_MISMATCH');result.ready[7]=task.state==='completed';
 }
 const knowledge=await knowledgeService.getCapability(org),agent=agentService.getCapability();
 if(!inspection.batches.some(b=>b.status==='completed'))result.blockers.push({message:'尚无完成导入的数据',href:'/dashboard/data/import'});
 if(!['admin','operator'].includes(actor.role))result.blockers.push({message:'当前账号仅可查看保存结果',href:'/dashboard/help'});
 if(agent.status!=='ready')result.blockers.push({message:'对话模型尚未配置',href:'/dashboard/help#agent'});
 if(knowledge.status!=='ready'||!knowledge.data?.currentSources)result.blockers.push({message:'请准备可检索的审核知识',href:'/dashboard/knowledge'});
 return result;
}

import {z} from 'zod';
import type {TaskState} from '../contracts/task-state';
import type {ToolDefinition} from '../contracts';
import type {AgentTaskGroup,AgentTaskIntent,AgentTaskMode,AgentTaskRouting} from '../contracts/research';
export type {AgentTaskGroup,AgentTaskIntent,AgentTaskMode,AgentTaskRouting} from '../contracts/research';

export const taskGroups=['guidance','analysis','tag','workflow','knowledge'] as const;
export const maximumTaskToolSwitches=2;
export const baseTaskToolNames=['query_scope_options','change_analysis_scope','list_datasets','search_knowledge'] as const;
/** These lists describe capabilities, never database access or formal-operation permission. */
export const taskToolGroups:Readonly<Record<AgentTaskGroup,readonly string[]>>={
 guidance:[],
 analysis:['query_metrics','query_metric_breakdown','query_learning_metrics','query_financial_metrics','query_alerts','query_profile'],
 tag:['query_tags','query_profile','propose_tag','edit_tag_draft','preview_tag_rule'],
 workflow:['query_reports','query_decision_tasks','query_task_owners','query_alerts','prepare_action_plan','prepare_decision_task','prepare_report'],
 knowledge:['save_knowledge_draft'],
};
const modeTools:Readonly<Record<AgentTaskMode,readonly string[]>>={
 operations:[...baseTaskToolNames,...taskToolGroups.analysis.filter(name=>!['query_learning_metrics','query_financial_metrics'].includes(name)),...taskToolGroups.tag,...taskToolGroups.workflow,...taskToolGroups.knowledge],
 learning:[...baseTaskToolNames,'query_learning_metrics'],
 finance:[...baseTaskToolNames,'query_financial_metrics','query_decision_tasks','query_task_owners','prepare_decision_task'],
};
export function taskToolAllowedInMode(name:string,mode:AgentTaskMode):boolean {
 return modeTools[mode]?.includes(name)??false;
}

export const selectTaskToolsSchema=z.object({
 groups:z.array(z.enum(taskGroups)).min(1).max(5).refine(values=>new Set(values).size===values.length,{message:'任务工具组不能重复'}),
 reason:z.string().trim().min(1).max(160).optional(),
}).strict();
export type SelectTaskToolsInput=z.infer<typeof selectTaskToolsSchema>;
/** The service handles this internal tool; it must never execute business operations. */
export const selectTaskToolsDefinition:ToolDefinition={
 name:'select_task_tools',mode:'read',status:'ready',
 description:'当前工具不足以完成用户明确提出的任务时，选择需要补充的任务组。指导、分析、标签、业务方案和知识草稿可组合；不授予角色或来源模式以外权限，不执行正式操作。每轮最多调整两次，仍计入工具预算。',
 parameters:{type:'object',properties:{groups:{type:'array',items:{type:'string',enum:[...taskGroups]},minItems:1,maxItems:5,uniqueItems:true},reason:{type:'string',minLength:1,maxLength:160}},required:['groups'],additionalProperties:false},
};

const analysisPattern=/(?:分析|指标|出勤|招生|转化|续费|留存|课耗|满班|客诉|退款|收入|成本|利润|财务|学习|活跃|点击|测评|成绩|退出|趋势|对比|同比|环比|为什么|原因|异常|下降|数据(?:情况|规模|怎样|什么样)|库里|多少|统计)/i;
const tagPattern=/(?:标签|规则|阈值|覆盖|名单|人群|画像|筛选学员|筛出|tag|segment)/i;
const workflowPattern=/(?:报告|周报|月报|决策|跟进|安排|任务|负责人|截止|期限|行动计划|操作计划|生成报告|report|workflow)/i;
const knowledgePattern=/(?:知识库|业务知识|知识材料|知识草稿|保存知识|录入(?:知识|材料)|收录|字段字典|指标口径|制度|文档|markdown|rag)/i;
const followupPattern=/(?:这个|这些|上一个|上一条|上一轮|继续|刚才|之前|阈值|改低|改高|改成|改为|调整一下|再预览)/;
const guidePattern=/(?:怎么|如何|在哪|哪里|步骤|教程|使用方法|能做什么|有什么功能|支持什么|帮助|介绍一下)/;
function explicitGroups(message:string):AgentTaskGroup[]{
 const groups:AgentTaskGroup[]=[];
 if(analysisPattern.test(message))groups.push('analysis');
 if(tagPattern.test(message))groups.push('tag');
 if(workflowPattern.test(message)||/(?:创建|建立|保存|建成).{0,10}人群|人群.{0,10}(?:创建|建立|保存|建成)/.test(message))groups.push('workflow');
 if(knowledgePattern.test(message))groups.push('knowledge');
 return groups;
}
function modeGroups(groups:AgentTaskGroup[],mode:AgentTaskMode):AgentTaskGroup[]{
 return groups.filter(group=>group==='guidance'||group==='knowledge'||taskToolGroups[group].some(name=>taskToolAllowedInMode(name,mode)));
}
/** A deterministic, zero-model-call first selection based only on user words and validated task memory. */
export function routeTask(message:string,taskState?:TaskState,mode:AgentTaskMode='operations'):AgentTaskRouting {
 const text=message.trim().replace(/(?:不要|别|无需|不需要|不想)[^，。；,;]*?(?=只|仅|而是|，|。|；|,|;|$)/g,' ');
 if(!text||/^(?:你好|您好|嗨|hello|hi|谢谢|感谢)[！!。\.\s]*$/i.test(text))return {intent:'guidance',groups:['guidance'],reason:'普通交流不需要先查询经营数据。'};
 const guide=guidePattern.test(text)&&!/(?:帮我|替我|给我|请你|直接|现在就)/.test(text);
 if(guide&&!/(?:为什么|原因|异常|下降|多少|分析一下|查询一下)/.test(text))return {intent:'guidance',groups:['guidance'],reason:'用户询问操作方法，先给出指导，仅在需要定位来源或口径时读取基础信息。'};
 let groups=explicitGroups(text);
 if(taskState&&followupPattern.test(text)){
  if(taskState.needsReview)return {intent:'clarification',groups:['guidance'],reason:'任务范围已变化，先确认当前目标和对象，不沿用旧范围执行。'};
  const inherited=explicitGroups(taskState.goal??'');
  if(!inherited.length&&taskState.selectedObjects.length===1){
   const kind=taskState.selectedObjects[0].kind;
   inherited.push(kind==='tag'||kind==='segment'?'tag':'workflow');
  }
  groups=[...new Set([...groups,...inherited])];
 }
 const allowed=modeGroups(groups,mode);
 if(groups.length&&!allowed.length)return {intent:'clarification',groups:['guidance'],reason:'当前数据来源不支持所提业务，先说明可用能力并确认下一步。'};
 if(!allowed.length)return {intent:'clarification',groups:['guidance'],reason:'任务目标不明确，先询问要分析、准备标签、安排业务还是整理知识。'};
 const ordered=taskGroups.filter(group=>allowed.includes(group));
 const intent:AgentTaskIntent=ordered.length>1?'compound':ordered[0];
 return {intent,groups:ordered,reason:ordered.length>1?'用户提出复合任务，合并相应工具组，并继续受角色和数据模式限制。':followupPattern.test(text)&&taskState?'沿用已确认的任务目标处理连续追问。':'依据用户明确提出的任务启用对应工具组。'};
}

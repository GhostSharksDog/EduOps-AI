import {z} from 'zod';
import {analysisScopeSchema,financeScopeSchema,learningScopeSchema} from '@/shared/contracts/analysis';

/** Business services supply bounded data, never executable chart options from a model. */
export const MAX_AGENT_VISUALIZATIONS=8;
export const MAX_AGENT_VISUAL_POINTS=30;
const pointSchema=z.object({value:z.number().finite().nullable(),status:z.enum(['ready','insufficient_data','not_applicable','unknown'])}).strict().refine(point=>point.status==='ready'||point.value===null,{message:'不可用数据不得绘制成有效数值'});
export const agentVisualizationSchema=z.object({
 id:z.string().min(1).max(240),title:z.string().min(1).max(160),kind:z.enum(['line','bar']),
 metricCodes:z.array(z.string().min(1).max(80)).min(1).max(8),unit:z.string().max(20),
 categories:z.array(z.string().min(1).max(160)).min(1).max(MAX_AGENT_VISUAL_POINTS),
 categoryLabel:z.string().min(1).max(40),
 series:z.array(z.object({name:z.string().min(1).max(80),points:z.array(pointSchema).min(1).max(MAX_AGENT_VISUAL_POINTS)}).strict()).min(1).max(3),
 evidenceIds:z.array(z.string().min(1).max(300)).min(1).max(200),
 source:z.object({datasetId:z.string().min(1).max(100),datasetName:z.string().min(1).max(160),origin:z.enum(['simulated','public']),analysisType:z.enum(['operations','learning','finance']),scope:z.union([analysisScopeSchema,learningScopeSchema,financeScopeSchema])}).strict(),
 note:z.string().max(500).optional(),
}).strict().superRefine((visual,ctx)=>{
 for(const [index,series] of visual.series.entries())if(series.points.length!==visual.categories.length)ctx.addIssue({code:'custom',message:'系列与分类数量不一致',path:['series',index,'points']});
 const matches=visual.source.analysisType==='operations'?'startDate' in visual.source.scope:visual.source.analysisType==='learning'?'courseKeys' in visual.source.scope:'years' in visual.source.scope;
 if(!matches)ctx.addIssue({code:'custom',message:'图表范围与数据模式不一致',path:['source','scope']});
});
export type AgentVisualization=z.infer<typeof agentVisualizationSchema>;

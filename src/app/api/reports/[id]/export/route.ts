import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi} from '@/modules/agent/server';
import {reportService,reportMarkdown} from '@/modules/report/server';
import {WorkflowError} from '@/shared/errors/workflow-error';
async function GETHandler(request:NextRequest,context:{params:Promise<{id:string}>}){return agentApi(request,async actor=>{const data=await reportService.get(actor,z.uuid().parse((await context.params).id));if(data.status!=='completed')throw new WorkflowError('只有生成完成的报告可以导出',409);return new NextResponse(reportMarkdown(data),{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="report-${data.id}.md"`}});});}

export const GET=withCompanyRoute(GETHandler);

import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {queryDashboard} from '@/modules/overview/server';
import {learningAnalytics} from '@/modules/analytics/server';
import {educationData} from '@/modules/education/server';
import {financeAnalytics} from '@/modules/finance/server';
import {datasetAnalysisType} from '@/modules/education/contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
import {dashboardQuerySchema} from '@/modules/overview/contracts';
import {apiError} from '@/shared/lib/api-error';
async function POSTHandler(request:NextRequest){const error=await authMiddleware(request);if(error)return error;try{
 const input=dashboardQuerySchema.parse(await request.json().catch(()=>null)),organizationId=getCurrentUser(request)!.ownedBy!;
 const {dataset}=await educationData.inspect(organizationId,input.datasetId);
 if(input.financeScope){const data=await financeAnalytics.query(input.datasetId,{...input.financeScope,organizationId});return NextResponse.json({status:'ready',data});}
 if(input.learningScope){if(datasetAnalysisType(dataset)!=='learning')throw new WorkflowError('模拟经营数据请使用自然日期范围',400);const data=await learningAnalytics.query(input.datasetId,{...input.learningScope,organizationId});return NextResponse.json({status:'ready',data:{...data,analysisType:'learning'}});}
 if(datasetAnalysisType(dataset)!=='operations')throw new WorkflowError('公开学习数据请使用课程批次和相对日期',400);
 const data=await queryDashboard(input.datasetId,{...input.scope!,organizationId,authorizedCampusIds:[]});return NextResponse.json({status:'ready',data});
 }catch(error){return apiError(error);}}

export const POST=withCompanyRoute(POSTHandler);

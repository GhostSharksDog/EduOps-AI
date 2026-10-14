import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {operations} from '@/modules/analytics/server';
import {analysisScopeSchema} from '@/shared/contracts/analysis';
import {apiError} from '@/shared/lib/api-error';
const schema=z.object({datasetId:z.uuid(),scope:analysisScopeSchema,metricCodes:z.array(z.string()).min(1).max(8).optional(),metricCode:z.string().optional()}).strict();
export async function POST(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const input=schema.parse(await request.json().catch(()=>null));const data=await operations.query(input.datasetId,{...input.scope,organizationId:getCurrentUser(request)!.ownedBy!,authorizedCampusIds:[]},input.metricCodes??(input.metricCode?[input.metricCode]:undefined));return NextResponse.json({status:'ready',data});}catch(e){return apiError(e);}}

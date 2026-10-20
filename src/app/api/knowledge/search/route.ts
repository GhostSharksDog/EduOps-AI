import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {searchKnowledgeSchema} from '@/modules/knowledge/contracts';
import {knowledgeService} from '@/modules/knowledge/server';
import {knowledgeRequest} from '../_helpers';
async function POSTHandler(request:NextRequest){return knowledgeRequest(request,async user=>{
 const input=searchKnowledgeSchema.parse(await request.json().catch(()=>null));const today=new Date().toISOString().slice(0,10);
 const scope={...(input.scope??{startDate:today,endDate:today,campusIds:[],courseIds:[],channelIds:[]}),organizationId:user.ownedBy!,authorizedCampusIds:[]};
 const result=await knowledgeService.search(input.query,scope,{limit:input.limit,includeSnapshots:input.includeSnapshots,signal:request.signal});return NextResponse.json(result,{status:result.status==='error'?503:result.status==='unconfigured'?503:200});
 });}

export const POST=withCompanyRoute(POSTHandler);

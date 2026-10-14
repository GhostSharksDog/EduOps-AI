import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {approveKnowledgeSourceSchema} from '@/modules/knowledge/contracts';
import {knowledgeService} from '@/modules/knowledge/server';
import {knowledgeRequest} from '../../../_helpers';
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}){return knowledgeRequest(request,async user=>{
 const input=approveKnowledgeSourceSchema.parse(await request.json().catch(()=>null));const result=await knowledgeService.approveAndIndex(z.uuid().parse((await context.params).id),user.ownedBy!,user.id,input);return NextResponse.json(result,{status:result.status==='ready'?200:503});
});}

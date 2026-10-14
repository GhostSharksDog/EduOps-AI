import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {reviseKnowledgeSourceSchema} from '@/modules/knowledge/contracts';
import {knowledgeService} from '@/modules/knowledge/server';
import {knowledgeRequest} from '../../_helpers';
type Context={params:Promise<{id:string}>};
export async function GET(request:NextRequest,context:Context){return knowledgeRequest(request,async user=>NextResponse.json({status:'ready',data:await knowledgeService.get(z.uuid().parse((await context.params).id),user.ownedBy!)}));}
export async function PATCH(request:NextRequest,context:Context){return knowledgeRequest(request,async user=>{const input=reviseKnowledgeSourceSchema.parse(await request.json().catch(()=>null));return NextResponse.json({status:'ready',message:'知识草稿已更新。',data:await knowledgeService.revise(z.uuid().parse((await context.params).id),user.ownedBy!,input)});});}

import {NextRequest,NextResponse} from 'next/server';
import {createKnowledgeSourceSchema} from '@/modules/knowledge/contracts';
import {knowledgeService} from '@/modules/knowledge/server';
import {knowledgeRequest} from '../_helpers';
export async function GET(request:NextRequest){return knowledgeRequest(request,async user=>NextResponse.json({status:'ready',data:await knowledgeService.list(user.ownedBy!)}));}
export async function POST(request:NextRequest){return knowledgeRequest(request,async user=>{const input=createKnowledgeSourceSchema.parse(await request.json().catch(()=>null));return NextResponse.json({status:'ready',message:'知识草稿已保存，审核后才能参与检索。',data:await knowledgeService.create(input,user.ownedBy!,user.id)},{status:201});});}

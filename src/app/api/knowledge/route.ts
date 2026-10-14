import {NextRequest,NextResponse} from 'next/server';
import {getCapability} from '@/modules/knowledge/server';
import {knowledgeRequest} from './_helpers';
export async function GET(request:NextRequest){return knowledgeRequest(request,async user=>NextResponse.json(await getCapability(user.ownedBy!)));}

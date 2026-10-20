import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {getCapability} from '@/modules/knowledge/server';
import {knowledgeRequest} from './_helpers';
async function GETHandler(request:NextRequest){return knowledgeRequest(request,async user=>NextResponse.json(await getCapability(user.ownedBy!)));}

export const GET=withCompanyRoute(GETHandler);

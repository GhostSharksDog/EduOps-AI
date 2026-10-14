import {NextRequest,NextResponse} from 'next/server';
import {agentApi,getCapability} from '@/modules/agent/server';
export async function GET(request:NextRequest){return agentApi(request,()=>NextResponse.json(getCapability()));}

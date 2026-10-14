import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware} from '@/modules/identity/server';
import {getCapability} from '@/modules/analytics/server';
export async function GET(request:NextRequest){const error=await authMiddleware(request);if(error)return error;return NextResponse.json(getCapability());}

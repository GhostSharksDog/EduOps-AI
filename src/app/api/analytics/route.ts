import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware} from '@/modules/identity/server';
import {getCapability} from '@/modules/analytics/server';
async function GETHandler(request:NextRequest){const error=await authMiddleware(request);if(error)return error;return NextResponse.json(getCapability());}

export const GET=withCompanyRoute(GETHandler);

import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {getOverview} from '@/modules/overview/server';
export async function GET(request:NextRequest){const error=await authMiddleware(request);if(error)return error;return NextResponse.json(await getOverview(getCurrentUser(request)!.ownedBy!));}

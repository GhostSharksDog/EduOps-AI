import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
export async function GET(request:NextRequest){const error=await authMiddleware(request);if(error)return error;return NextResponse.json({user:getCurrentUser(request)});}

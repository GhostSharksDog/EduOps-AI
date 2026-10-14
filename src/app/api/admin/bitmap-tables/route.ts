import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, adminMiddleware, getCurrentUser} from '@/modules/identity/server';
import {getBitmapApplicationService, getBitmapOHSAdapter} from '@/modules/tag/server';
import {handleAPIError} from '@/platform/api-error-handler';

export async function GET(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({error:'请先登录'},{status:401});
    
    const adminError = adminMiddleware(request);
    if (adminError) return adminError;

    try {
        const {searchParams} = new URL(request.url);
        const action = searchParams.get('action');
        
        if (action === 'entityTypes') {
            const bitmapApplicationService = getBitmapApplicationService();
            const entityTypes = await bitmapApplicationService.getEntityTypes({tenantId:user.ownedBy});
            return NextResponse.json({entityTypes});
        }
        
        const bitmapOHSAdapter = getBitmapOHSAdapter();
        const bitmapApplicationService = getBitmapApplicationService();
        
        const query = bitmapOHSAdapter.fromRequestToListQuery(request);
        const result = await bitmapApplicationService.listBitmapTables({...query,tenantFilter:{tenantId:user.ownedBy}});
        return NextResponse.json(result);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function POST(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({error:'请先登录'},{status:401});
    
    const adminError = adminMiddleware(request);
    if (adminError) return adminError;

    try {
        const bitmapOHSAdapter = getBitmapOHSAdapter();
        const bitmapApplicationService = getBitmapApplicationService();
        
        const dto = await bitmapOHSAdapter.fromRequestToCreateCommand(request);
        const result = await bitmapApplicationService.createBitmapTable(dto,user.ownedBy);
        return NextResponse.json(result, {status: 201});
    } catch (error) {
        return handleAPIError(error);
    }
}

import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {getBitmapApplicationService} from '@/modules/tag/server';
import { handleAPIError } from '@/platform/api-error-handler';
import { z } from 'zod';

const assignBitSchema = z.object({
  tagId: z.string().uuid(),
});

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bitIndex: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;
  const user=getCurrentUser(request);
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});

  const { id: bitmapTableId, bitIndex: bitIndexStr } = await params;
  const bitIndex = parseInt(bitIndexStr, 10);

  if (isNaN(bitIndex)) {
    return NextResponse.json(
      { error: '无效的位索引' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { tagId } = assignBitSchema.parse(body);

    const userId = user.id;

    const bitmapApplicationService = getBitmapApplicationService();
    const result = await bitmapApplicationService.assignBitToTag(
      bitmapTableId,
      bitIndex,
      tagId,
      userId,
      undefined,
      undefined,
      undefined,
      {tenantId:user.ownedBy}
    );

    return NextResponse.json({
      success: true,
      assignment: result,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bitIndex: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;
  const user=getCurrentUser(request);
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});

  const { id: bitmapTableId, bitIndex: bitIndexStr } = await params;
  const bitIndex = parseInt(bitIndexStr, 10);

  if (isNaN(bitIndex)) {
    return NextResponse.json(
      { error: '无效的位索引' },
      { status: 400 }
    );
  }

  try {
    const userId = user.id;

    const bitmapApplicationService = getBitmapApplicationService();
    await bitmapApplicationService.unassignBit(
      bitmapTableId,
      bitIndex,
      userId,
      {tenantId:user.ownedBy}
    );

    return NextResponse.json({
      success: true,
      message: 'Bit 分配已取消',
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

export const POST=withCompanyRoute(POSTHandler);
export const DELETE=withCompanyRoute(DELETEHandler);

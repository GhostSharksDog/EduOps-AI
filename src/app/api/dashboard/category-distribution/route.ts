import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/platform/logger';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';
import {queryRows} from '@/platform/database';
import { type CategoryDistributionItem } from '@/shared/schemas/response/dashboard/index';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export async function GET(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const { searchParams } = request.nextUrl;
    const rawQuery = {
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
    };
    const query = querySchema.parse(rawQuery);

    const user=getCurrentUser(request);
    const allCategories=await queryRows(`SELECT c.id,c.name,COUNT(t.id)::int AS "tagCount" FROM tag_category c
      LEFT JOIN tag t ON t.category_id=c.id AND NOT t.is_deleted AND t.owned_by=$1
      WHERE NOT c.is_deleted AND c.owned_by=$1 GROUP BY c.id,c.name`,[user?.ownedBy]);
    const categoriesWithCount=allCategories;

    const totalCount = categoriesWithCount.reduce((sum, cat) => sum + cat.tagCount, 0);

    const colors = [
      '#1677ff', '#52c41a', '#faad14', '#eb2f96', '#fa8c16',
      '#722ed1', '#13c2c2', '#fa5c16', '#2f54eb', '#1890ff', '#ff7a45', '#00d2b8'
    ];

    const categories: CategoryDistributionItem[] = categoriesWithCount
      .sort((a, b) => b.tagCount - a.tagCount)
      .slice((query.page - 1) * query.pageSize,query.page * query.pageSize)
      .map((category, index) => ({
        id: category.id,
        name: category.name || '未命名分类',
        count: category.tagCount,
        percentage: totalCount > 0 ? Math.round((category.tagCount / totalCount) * 100) : 0,
        color: colors[index % colors.length],
      }));

    log.info('标签分类分布查询成功', {
      total: allCategories.length,
      returned: categories.length,
    });

    return NextResponse.json({
      categories,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

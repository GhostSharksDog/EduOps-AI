import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {log} from '@/platform/logger';
import {getClickHouseClient} from '@/modules/tag/server';
import {getMvConfigRepository} from '@/modules/tag/server';

const deleteMvSchema = z.object({
  mvNames: z.array(z.string().min(1)).min(1, '至少选择一个MV'),
});

async function POSTHandler(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {mvNames} = deleteMvSchema.parse(body);

    const chClient = getClickHouseClient();
    const mvConfigRepo = getMvConfigRepository();
    const results: {name: string; success: boolean; error?: string}[] = [];

    for (const mvName of mvNames) {
      try {
        // 1. 删除 ClickHouse 中的 MV
        await chClient.dropMaterializedView(mvName);

        // 2. 删除 PG 中的 MV 配置记录
        const config = await mvConfigRepo.findByMvName(mvName);
        if (config) {
          await mvConfigRepo.delete(config.id);
        }

        results.push({name: mvName, success: true});
        log.info('MV监控页面删除MV成功', {mvName});
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({name: mvName, success: false, error: msg});
        log.warn('MV监控页面删除MV失败', {mvName, error: msg});
      }
    }

    const failedCount = results.filter(r => !r.success).length;
    if (failedCount > 0 && failedCount === results.length) {
      return NextResponse.json({
        error: '所有MV删除失败',
        results,
      }, {status: 500});
    }

    return NextResponse.json({
      message: `成功删除 ${results.length - failedCount} 个MV${failedCount > 0 ? `，${failedCount} 个失败` : ''}`,
      results,
    });
  } catch (error) {
    log.error('POST /api/tags/monitor/mv - Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: '参数验证失败',
        details: error.issues,
      }, {status: 400});
    }
    return handleAPIError(error);
  }
}

export const POST=withCompanyRoute(POSTHandler);

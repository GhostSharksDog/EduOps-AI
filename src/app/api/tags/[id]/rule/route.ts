import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {getTagActivationApplicationService} from '@/modules/tag/server';
import {UpdateTagRuleCommand} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import { handleAPIError } from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import { config } from '@/platform/config/index';
import { MESSAGES } from '@/shared/messages/index';
import { RuleType } from '@/shared/enums/index';
import { z } from 'zod';

const updateTagRuleSchema = z.object({
  ruleType: z.enum(['SQL', 'CASCADE', 'EXPRESSION', 'MODEL']),
  ruleContent: z.string().optional(),
  dataModelIds: z.array(z.string()).optional(),
  steps: z.array(z.object({
    order: z.number(),
    sql: z.string(),
  })).optional(),
});

interface UpdateTagRuleRequestBody {
  ruleType: 'SQL' | 'CASCADE' | 'EXPRESSION' | 'MODEL';
  ruleContent?: string;
  dataModelIds?: string[];
  steps?: Array<{ order: number; sql: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId } = await params;

  try {
    const body = await request.json() as UpdateTagRuleRequestBody;
    
    const validationResult = updateTagRuleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '无效的请求体', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const service = getTagActivationApplicationService();
    const userId = request.headers.get('x-user-id') ?? config.system.userId;
    
    const command = new UpdateTagRuleCommand(
      tagId,
      {
        ruleType: body.ruleType,
        ruleContent: body.ruleContent,
        dataModelIds: body.dataModelIds,
        steps: body.steps,
      },
      userId
    );

    await service.updateTagRule(command);

    await withAudit(request, {
      entityId: tagId,
      metadata: {
        ruleType: body.ruleType,
      }
    });

    return NextResponse.json({
      success: true,
      message: '标签规则已更新，将创建新版本',
    });
  } catch (error) {
    log.error('POST /api/tags/[id]/rule - Error:', error);
    return handleAPIError(error);
  }
}

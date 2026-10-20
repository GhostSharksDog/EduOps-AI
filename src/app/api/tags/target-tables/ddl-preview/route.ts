import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {authMiddleware} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';
import { generateTargetTableDDL, DDLGenerateResult, DDLTableType } from '@/platform/ddl/index';
import { TagValueType } from '@/shared/enums/tag/TagValueType';

const DDLPreviewRequestSchema = z.object({
  tableName: z.string()
    .min(1, '表名不能为空')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, '表名必须以字母或下划线开头，仅包含字母、数字和下划线'),
  entityTypeCode: z.string()
    .min(1, '实体类型代码不能为空')
    .regex(/^[A-Z][A-Z0-9_]*$/, '实体类型代码必须为大写字母开头，仅包含大写字母、数字和下划线'),
  entityTypeId: z.string()
    .min(1, '实体类型ID不能为空')
    .uuid('实体类型ID必须是有效的UUID'),
  tagValueType: z.nativeEnum(TagValueType, {
    error: `标签值类型必须是: ${Object.values(TagValueType).join(', ')}`,
  }).optional(),
  tableType: z.enum(['PHYSICAL_TABLE', 'VIEW', 'INTERMEDIATE']).optional().default('PHYSICAL_TABLE'),
  dimensionColumns: z.string().optional().describe('维度列JSON配置'),
  aggregateFunctionName: z.string().optional().describe('聚合函数名'),
});

async function POSTHandler(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const validatedData = DDLPreviewRequestSchema.parse(body);

    const result = generateTargetTableDDL({
      tableName: validatedData.tableName,
      entityTypeCode: validatedData.entityTypeCode,
      entityTypeId: validatedData.entityTypeId,
      tagValueType: validatedData.tagValueType,
      tableType: validatedData.tableType as DDLTableType,
      dimensionColumns: validatedData.dimensionColumns ? JSON.parse(validatedData.dimensionColumns) : undefined,
      aggregateFunctionName: validatedData.aggregateFunctionName,
    });

    return NextResponse.json({
      success: true,
      data: result as DDLGenerateResult,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

export const POST=withCompanyRoute(POSTHandler);

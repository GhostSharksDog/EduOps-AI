import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {WorkflowError} from '@/shared/errors/workflow-error';
export function apiError(error:unknown){if(error instanceof WorkflowError)return NextResponse.json({status:'error',message:error.message,...(error.code?{errorCode:error.code}:{})},{status:error.status});if(error instanceof ZodError)return NextResponse.json({status:'error',message:'请求参数无效',issues:error.issues},{status:400});const raw=error instanceof Error?error.message:'',safe=/数据集|已有导入|来源配置|渠道筛选|无法创建|CSV|单批|公开OULAD|行为事件存储/.test(raw);return NextResponse.json({status:'error',message:safe?raw:'数据服务暂不可用，请检查服务配置或导入状态'},{status:/不存在或无权/.test(raw)?404:/已有导入/.test(raw)?409:safe?400:503});}

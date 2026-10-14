import {z} from 'zod';

// 设置当前版本schema
export const setCurrentVersionSchema = z.strictObject({
    versionId: z.uuid('版本ID必须是有效的UUID').describe('要设置为当前版本的版本ID'),
});

// 导出TypeScript类型
export type SetCurrentVersionDTO = z.infer<typeof setCurrentVersionSchema>;
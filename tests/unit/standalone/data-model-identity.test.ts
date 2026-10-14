import {describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const identity = vi.hoisted(() => ({userId: '11111111-1111-4111-8111-111111111111' as string | null}));
vi.mock('@/modules/identity/server', () => ({getCurrentUserId: () => identity.userId}));

import {DataModelOHSAdapterImpl} from '@/modules/data/services/data-model/DataModelOHSAdapterImpl';

const institutionId = '22222222-2222-4222-8222-222222222222';
const forgedInstitutionId = '33333333-3333-4333-8333-333333333333';
const modelId = '44444444-4444-4444-8444-444444444444';
const sourceId = '55555555-5555-4555-8555-555555555555';

function request(method: string, body: unknown) {
    // 此身份头代表中间件验证JWT后设置的机构范围；外部伪造头由登录测试覆盖。
    return new NextRequest('http://localhost/api/data-models', {
        method,
        headers: {'Content-Type': 'application/json', 'x-tenant-id': institutionId},
        body: JSON.stringify(body),
    });
}

describe('数据模型请求的机构归属', () => {
    it('创建时忽略客户端提交的其他机构ID，并保留已验证的操作者', async () => {
        const command = await new DataModelOHSAdapterImpl().fromRequestToCreateDataModelCommand(
            request('POST', {name: '出勤事件', datasourceId: sourceId, ownedBy: forgedInstitutionId}),
        );
        expect(command.ownedBy).toBe(institutionId);
        expect(command.createdBy).toBe(identity.userId);
    });

    it('更新时不接受客户端指定的其他机构ID', async () => {
        const command = await new DataModelOHSAdapterImpl().fromRequestToUpdateDataModelCommand(
            request('PUT', {id: modelId, name: '出勤事件修订', ownedBy: forgedInstitutionId}),
            modelId,
        );
        expect(command.ownedBy).toBe(institutionId);
        expect(command.updatedBy).toBe(identity.userId);
    });

    it('缺少已验证的操作者时不创建命令', async () => {
        const previousUser = identity.userId;
        identity.userId = null;
        try {
            await expect(new DataModelOHSAdapterImpl().fromRequestToCreateDataModelCommand(
                request('POST', {name: '出勤事件', datasourceId: sourceId, ownedBy: institutionId}),
            )).rejects.toThrow('请求中未找到用户ID');
        } finally {
            identity.userId = previousUser;
        }
    });
});

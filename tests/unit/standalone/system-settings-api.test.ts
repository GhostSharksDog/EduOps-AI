import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest, NextResponse} from 'next/server';

const mocks = vi.hoisted(() => ({auth: vi.fn(), user: vi.fn(), query: vi.fn(), audit: vi.fn()}));
vi.mock('@/platform/database', () => ({queryOne: mocks.query}));
vi.mock('@/platform/logger', () => ({log: {info: vi.fn(), error: vi.fn()}}));
vi.mock('@/modules/identity/server', () => ({
    withCompanyRoute: (handler: unknown) => handler,
    authMiddleware: mocks.auth,
    getCurrentUser: mocks.user,
}));
vi.mock('@/modules/system/server', async () => ({
    ...await import('@/modules/system/services/settings'),
    withAudit: mocks.audit,
}));
import {GET, PUT} from '@/app/api/settings/route';

const defaults = {sessionTimeout: 30, pageSize: 20, language: 'zh-CN', theme: 'light'};
const request = (method: 'GET' | 'PUT' = 'GET', body?: unknown) => new NextRequest('http://local/api/settings', {
    method,
    headers: {'Content-Type': 'application/json', 'x-tenant-id': 'forged-company', 'x-user-id': 'forged-user'},
    ...(method === 'PUT' ? {body: JSON.stringify(body)} : {}),
});

beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue(undefined);
    mocks.user.mockReturnValue({id: 'verified-user', ownedBy: 'verified-company', role: 'admin'});
    mocks.query.mockResolvedValue(null);
    mocks.audit.mockResolvedValue(undefined);
});

describe('系统设置读取无副作用与公司身份', () => {
    it('没有配置时返回原缺省值，仅SELECT且不创建记录或写审计', async () => {
        const response = await GET(request());
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(defaults);
        expect(mocks.query).toHaveBeenCalledTimes(1);
        expect(mocks.query.mock.calls[0]).toEqual(['SELECT config FROM system_config WHERE owned_by=$1', ['verified-company']]);
        expect(mocks.audit).not.toHaveBeenCalled();
        expect(response.headers.get('cache-control')).toBe('private, no-store');
    });

    it('已有配置保留保存值及其他配置，只补缺省字段，不更新已有行', async () => {
        const alertRules = {current: {version: 2}, history: []};
        mocks.query.mockResolvedValue({config: {theme: 'dark', pageSize: 50, alertRules}});
        const response = await GET(request());
        expect(await response.json()).toEqual({...defaults, theme: 'dark', pageSize: 50, alertRules});
        expect(mocks.query).toHaveBeenCalledTimes(1);
        expect(mocks.query.mock.calls[0][0]).toMatch(/^SELECT /);
        expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('忽略伪造公司头，两家公司的读取按各自已验证身份过滤', async () => {
        await GET(request());
        mocks.user.mockReturnValue({id: 'second-user', ownedBy: 'second-company', role: 'admin'});
        await GET(request());
        expect(mocks.query.mock.calls.map(([, args]) => args)).toEqual([['verified-company'], ['second-company']]);
    });

    it.each([GET, PUT])('未登录不读取或保存设置', async handler => {
        mocks.auth.mockResolvedValue(NextResponse.json({error: '请先登录'}, {status: 401}));
        const response = await handler(request(handler === GET ? 'GET' : 'PUT', {theme: 'dark'}));
        expect(response.status).toBe(401);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.audit).not.toHaveBeenCalled();
    });

    it.each([null, {id: 'verified-user'}, {ownedBy: 'verified-company'}])('验证身份缺失时拒绝访问，不回退系统机构：%j', async user => {
        mocks.user.mockReturnValue(user);
        expect((await GET(request())).status).toBe(401);
        expect((await PUT(request('PUT', {theme: 'dark'}))).status).toBe(401);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('非管理员权限拒绝时不执行数据库操作', async () => {
        mocks.auth.mockResolvedValue(NextResponse.json({error: '当前角色没有此操作权限'}, {status: 403}));
        expect((await GET(request())).status).toBe(403);
        expect((await PUT(request('PUT', {theme: 'dark'}))).status).toBe(403);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.audit).not.toHaveBeenCalled();
    });
});

describe('系统设置明确保存与审计', () => {
    it('PUT只合并提交字段，绑定验证公司和账号，并显式记录设置审计', async () => {
        const alertRules = {current: {version: 3}, history: []};
        mocks.query.mockResolvedValue({id: 'settings-id', config: {...defaults, theme: 'dark', alertRules}});
        const submitted = request('PUT', {theme: 'dark'});
        const response = await PUT(submitted);
        expect(await response.json()).toEqual({...defaults, theme: 'dark', alertRules});
        const [sql, args] = mocks.query.mock.calls[0];
        expect(sql).toContain('config=system_config.config || $3::jsonb');
        expect(args).toEqual(['verified-company', JSON.stringify(defaults), JSON.stringify({theme: 'dark'}), 'verified-user']);
        expect(mocks.audit).toHaveBeenCalledOnce();
        expect(mocks.audit).toHaveBeenCalledWith(submitted, {entity: 'SystemConfig', entityId: 'settings-id', metadata: {changes: {theme: 'dark'}}});
        expect(response.headers.get('cache-control')).toBe('private, no-store');
    });

    it.each([{theme: 'invalid'}, {ownedBy: 'forged-company'}, {alertRules: {}}, {pageSize: 1}])('拒绝非法字段或越界值，保存前停止：%j', async body => {
        const response = await PUT(request('PUT', body));
        expect(response.status).toBe(400);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.audit).not.toHaveBeenCalled();
    });
});

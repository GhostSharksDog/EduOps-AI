import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {execute, queryOne} from '@/platform/database';
import {systemSettingsService} from '@/modules/system/services/settings';

const first = randomUUID(), second = randomUUID(), user = randomUUID();
let verified = false;
function testOnly() {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (url.hostname !== '127.0.0.1' || url.port !== '25432' || url.pathname !== '/education_cleanup_test') {
        throw new Error('设置测试仅允许25432 education_cleanup_test专用库');
    }
}
const stored = (org: string) => queryOne('SELECT * FROM system_config WHERE owned_by=$1', [org]);

beforeAll(async () => {
    testOnly();
    expect((await queryOne<{name: string}>('SELECT current_database() AS name'))?.name).toBe('education_cleanup_test');
    verified = true;
});
afterAll(async () => {
    if (!verified) return;
    testOnly();
    await execute('DELETE FROM system_config WHERE owned_by=ANY($1::uuid[])', [[first, second]]);
});

describe('设置服务真实数据库的只读和局部保存', () => {
    it('缺配置多次读取不产生行，已有配置读取不改时间或正文', async () => {
        expect(await stored(first)).toBeNull();
        expect(await systemSettingsService.get(first)).toMatchObject({sessionTimeout: 30, theme: 'light'});
        await systemSettingsService.get(first);
        expect(await stored(first)).toBeNull();
        await execute('INSERT INTO system_config(owned_by,config,update_time,created_by) VALUES($1,$2::jsonb,NOW(),$3)', [first, JSON.stringify({theme: 'dark', alertRules: {marker: 'keep'}}), user]);
        const before = await stored(first);
        expect(await systemSettingsService.get(first)).toMatchObject({theme: 'dark', alertRules: {marker: 'keep'}});
        expect(await stored(first)).toEqual(before);
    });

    it('两机构局部保存互不影响，并保留非设置模块配置', async () => {
        await systemSettingsService.update(second, user, {theme: 'auto'});
        const beforeSecond = await stored(second);
        await systemSettingsService.update(first, user, {pageSize: 50});
        expect(await systemSettingsService.get(first)).toMatchObject({theme: 'dark', pageSize: 50, alertRules: {marker: 'keep'}});
        expect(await stored(second)).toEqual(beforeSecond);
        expect(await systemSettingsService.get(second)).toMatchObject({theme: 'auto', pageSize: 20});
    });
});

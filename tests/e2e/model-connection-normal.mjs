// 正常环境模型连接复核：仅创建指导／只读分析记录，不确认任何业务操作。
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {config} from 'dotenv';
import pg from 'pg';
import {SignJWT} from 'jose';
import {chromium} from '@playwright/test';

const env = {...process.env};
config({path: ['.env.local', '.env'], processEnv: env, quiet: true});
const connection = new URL(env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(connection.hostname)
    && connection.port === '15434' && connection.pathname === '/metadata_dev', '仅允许本项目正常环境');
const base = 'http://localhost:3000';
const dir = env.LOCAL_QA_ARTIFACT_DIR ?? 'tests/artifacts/model-connection-qa';
await mkdir(dir, {recursive: true});
const result = {testedAt: new Date().toISOString(), attempts: [], browserErrors: [], blocked: [], businessObjectsUnchanged: false};
const db = new pg.Client({connectionString: connection.toString()});
let user, browser;
try {
    await db.connect();
    await db.query('BEGIN READ ONLY');
    const rows = await db.query('SELECT id, username, role, organization_id AS "ownedBy" FROM local_user WHERE enabled=true AND organization_id=$1::uuid ORDER BY CASE role WHEN \'admin\' THEN 0 ELSE 1 END LIMIT 1', [env.SYSTEM_USER_ID || '6f40f555-5f1b-4d1f-807c-b209e817bfdd']);
    assert.ok(rows.rows[0], '需要已有可用账号');
    user = {...rows.rows[0], realName: '本地账号', email: ''};
    await db.query('ROLLBACK');
} finally { await db.end(); }

try {
    const companies = await (await fetch(base + '/api/auth/companies')).json();
    const company = companies.companies.find(item => item.code === (env.DEFAULT_COMPANY_CODE ?? 'main'));
    assert.ok(company);
    user = {...user, companyCode: company.code, companyName: company.name};
    const token = await new SignJWT(user).setProtectedHeader({alg: 'HS256'}).setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(env.JWT_SECRET));
    browser = await chromium.launch({channel: 'msedge', headless: true});
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai'});
    await context.addInitScript(({token, user}) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    }, {token, user});
    let newSessionId;
    const allowedPosts = new Set(['/api/agent/runs', '/api/overview/query', '/api/overview/journey/query', '/api/analytics/query', '/api/analytics/channels/catalog']);
    await context.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== base || !['GET', 'HEAD'].includes(request.method()) && !(request.method() === 'POST' && allowedPosts.has(url.pathname))) {
            result.blocked.push({method: request.method(), path: url.pathname});
            return route.abort('blockedbyclient');
        }
        if (url.pathname === '/api/agent/runs' && request.method() === 'POST') {
            const input = request.postDataJSON();
            // 首个请求必须新建会话；后续只允许使用本次新建的会话，禁止重放历史对话。
            if (input.sessionId !== newSessionId) {
                result.blocked.push({reason: '只能使用本次全新会话'});
                return route.abort('blockedbyclient');
            }
        }
        return route.continue();
    });
    const get = async path => {
        const response = await context.request.get(base + path, {headers: {Authorization: 'Bearer ' + token}});
        assert.equal(response.status(), 200, path);
        return (await response.json()).data;
    };
    const inventory = async () => Object.fromEntries(await Promise.all(['/api/tags/proposals', '/api/segments/risk-snapshots', '/api/reports', '/api/decisions', '/api/knowledge/sources'].map(async path => [path, (await get(path)).map(item => ({id: item.id, status: item.status, state: item.state, version: item.version, memberCount: item.memberCount}))])));
    const before = await inventory();
    const previous = JSON.parse(await readFile('tests/artifacts/decision-qa/normal-flows-progress.json', 'utf8'));
    const saved = await get('/api/segments/risk-snapshots/' + previous.flows[0].snapshotId);
    const source = (await get('/api/education/datasets')).find(item => item.id === saved.datasetId);
    assert.ok(source?.origin === 'simulated' && source.schemaVersion === '3', '只允许固定种子第三版模拟数据');
    result.source = {origin: 'simulated', schemaVersion: '3', freshConversationOnly: true};
    const {organizationId, authorizedCampusIds, ...savedScope} = saved.preview.scope;
    const scope = {...savedScope, campusIds: [], courseIds: [], channelIds: []};
    const page = await context.newPage();
    page.on('pageerror', error => result.browserErrors.push(error.name));
    page.setDefaultTimeout(30000);
    if (env.LOCAL_QA_VERIFY_PARTIAL_RUN) {
        const partial = await get('/api/agent/runs/' + env.LOCAL_QA_VERIFY_PARTIAL_RUN);
        assert.equal(partial.status, 'failed');
        assert.ok(partial.answer?.facts?.length > 0);
        await page.goto(base + '/dashboard/agent?' + new URLSearchParams({runId: partial.id}), {waitUntil: 'networkidle'});
        await page.getByText('数据已查到，智能解读未完成', {exact: true}).waitFor();
        assert.equal(await page.locator('[data-testid=agent-error]').count(), 0);
        await page.screenshot({path: dir + '/partial-analysis.png', fullPage: true, mask: [page.locator('.header-user-name')], maskColor: '#ffffff'});
        result.partialAnalysisPreserved = {runId: partial.id, facts: partial.answer.facts.length};
    }
    await page.goto(base + '/dashboard/agent?' + new URLSearchParams({datasetId: saved.datasetId, scope: JSON.stringify(scope)}), {waitUntil: 'networkidle'});
    const input = page.getByRole('textbox', {name: 'Agent问题', exact: true});
    await input.waitFor();
    const tasks = [
        ['data-overview', '现在库里的数据是什么样的？请只查询并介绍，不创建任何对象。'],
        ['metrics', '请查询当前范围的出勤率，只展示已核验结果与依据，不创建任何对象。'],
    ];
    for (const [name, question] of tasks) {
        await input.fill(question);
        const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/agent/runs' && response.request().method() === 'POST', {timeout: 140000});
        await page.getByRole('button', {name: '发送Agent问题', exact: true}).click();
        const response = await pending, body = await response.json(), run = body.data;
        if (run?.sessionId) newSessionId = run.sessionId;
        const runtime = run?.steps?.find(step => step.runtime)?.runtime;
        result.attempts.push({name, httpStatus: response.status(), runId: run?.id, status: run?.status, errorCode: run?.errorCode ?? null, errorMessage: run?.errorMessage ?? null, answerPresent: !!run?.answer, factCount: run?.answer?.facts?.length ?? 0, toolNames: (run?.steps ?? []).map(step => step.tool), evidenceCount: run?.evidence?.length ?? 0, modelCalls: runtime?.inputSummary?.calls ?? null, recovery: runtime?.recovery ?? null});
        await page.locator('[data-testid=agent-run-details]').waitFor();
        await page.screenshot({path: dir + '/agent-' + name + '.png', fullPage: true, mask: [page.locator('.header-user-name')], maskColor: '#ffffff'});
        await writeFile(dir + '/browser-verification.json', JSON.stringify(result, null, 2));
        if (run?.status === 'failed') break;
        assert.equal(run?.status, 'completed');
        assert.ok(run.answer);
    }
    assert.deepEqual(await inventory(), before);
    result.businessObjectsUnchanged = true;
    assert.deepEqual(result.blocked, []);
    assert.deepEqual(result.browserErrors, []);
    result.passed = result.attempts.length === 2 && result.attempts.every(item => item.status === 'completed');
    if (!result.passed) process.exitCode = 1;
    console.log(JSON.stringify(result));
} catch (error) {
    result.passed = false;
    result.failure = error instanceof Error && error.name === 'AssertionError' ? '页面结果未符合验证约定' : '页面连接复核未完成';
    console.log(JSON.stringify(result));
    process.exitCode = 1;
} finally {
    await writeFile(dir + '/browser-verification.json', JSON.stringify(result, null, 2));
    await browser?.close();
}

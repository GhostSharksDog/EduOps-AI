import assert from 'node:assert/strict';
import {existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {chromium, expect} from '@playwright/test';

const baseURL = process.env.AGENT_UI_BASE_URL || 'http://localhost:3302';
const screenshotDir = process.env.AGENT_UI_SCREENSHOT_DIR;
if (screenshotDir) mkdirSync(screenshotDir, {recursive: true});
const installedBrowser = [
    process.env.AGENT_UI_BROWSER,
    chromium.executablePath(),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(path => path && existsSync(path));
const browser = await chromium.launch({headless: true, ...(installedBrowser ? {executablePath: installedBrowser} : {})});
const ids = {
    dataset: '11111111-1111-4111-8111-111111111111', session: '22222222-2222-4222-8222-222222222222',
    run: '33333333-3333-4333-8333-333333333333', proposal: '44444444-4444-4444-8444-444444444444',
    token: '55555555-5555-4555-8555-555555555555',
};
const timestamp = '2026-09-30T15:59:59.000Z';
const scope = {startDate: '2026-04-01', endDate: '2026-09-30', campusIds: [], courseIds: [], channelIds: [], dataCutoff: timestamp};
const evidence = {id: 'metric-evidence', kind: 'metric', sourceId: '验收计算批次', version: '1', summary: '已完成导入批次计算的出勤率', scope, updatedAt: timestamp};
const session = {id: ids.session, title: '验收出勤分析', datasetId: ids.dataset, scope: {...scope, organizationId: 'fixture-org', authorizedCampusIds: []}, editable: true, createdBy: 'fixture-user', createdAt: timestamp, updatedAt: timestamp};
const dataset = {id: ids.dataset, key: 'fixture-training', name: 'UI验收模拟数据', origin: 'simulated', license: '项目模拟', schemaVersion: '1', description: '隔离验收数据，不连接业务数据库', dataCutoff: timestamp, createdAt: timestamp};
const facts = [
    {id: 'attendance_rate', label: '出勤率', value: 76.25, unit: 'percent', status: 'ready', numerator: 305, denominator: 400, evidenceIds: [evidence.id]},
    {id: 'hours_progress', label: '课耗进度', value: null, unit: 'percent', status: 'insufficient_data', numerator: null, denominator: 0, evidenceIds: [evidence.id]},
];
function makeRun(failed = false) {
    return {id: ids.run, sessionId: ids.session, status: failed ? 'failed' : 'awaiting_confirmation', startedAt: timestamp, completedAt: timestamp,
        steps: [{id: 'metrics-step', tool: 'query_metrics', status: 'completed', evidence: [evidence], facts}],
        proposals: [{id: ids.proposal, kind: 'tag', version: 2, status: 'awaiting_confirmation', name: '验收关注标签', estimatedCount: 18, previewToken: ids.token, previewFingerprint: 'fixture-fingerprint', publishedTagId: null, evidence: [evidence]}],
        evidence: [evidence], answer: failed ? null : {summary: '本周期出勤率为76.25%，需要进一步核查缺勤原因。', facts, hypotheses: ['缺勤可能与排课时间有关，需核查。'], recommendations: ['先核对服务记录，再联系学员。'], limitations: ['课耗数据不足，无法计算进度。']},
        errorCode: failed ? 'MODEL_TIMEOUT' : null, errorMessage: failed ? '对话服务超时，已保存工具结果' : null};
}
async function setup({role = 'operator', scenario = 'ready', saved = false, editable = true} = {}) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1080}});
    await context.addInitScript(({role}) => {
        localStorage.setItem('auth_token', 'ui-fixture-token');
        localStorage.setItem('auth_user', JSON.stringify({id: 'fixture-user', username: '界面验收账号', role, ownedBy: 'fixture-org'}));
    }, {role});
    const writes = [], confirmations = [];
    let run = makeRun(scenario === 'failed'), hasSession = saved, aborted = false;
    const editableSession = {...session, editable};
    await context.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const reply = (data, status = 200, message = '已就绪', capability = 'ready') => route.fulfill({status, contentType: 'application/json', body: JSON.stringify({status: capability, message, data})});
        if (path === '/api/agent') return reply({tools: [{name: 'query_metrics', description: '计算经营指标', mode: 'read', status: 'ready'}]}, 200, scenario === 'unconfigured' ? '对话服务尚未配置' : '助手已配置', scenario === 'unconfigured' ? 'unconfigured' : 'ready');
        if (path === '/api/education/datasets') return reply([dataset]);
        if (path === '/api/education/datasets/' + ids.dataset) return reply({dataset, catalog: [{id: 'campus-a', kind: 'campus', name: '验收校区'}, {id: 'course-a', kind: 'course', name: '验收课程'}], batches: []});
        if (path === '/api/agent/sessions') return reply(hasSession ? [editableSession] : []);
        if (path === '/api/agent/sessions/' + ids.session) return reply({session: editableSession, messages: [{id: 'message-a', sessionId: ids.session, runId: ids.run, role: 'user', content: '核查出勤', createdAt: timestamp}], runs: [run]});
        if (path === '/api/agent/runs/' + ids.run) return reply(run);
        if (path === '/api/agent/runs' && request.method() === 'POST') {
            const payload = request.postDataJSON(); writes.push(payload);
            if (scenario === 'network_retry' && !aborted) {aborted = true; return route.abort('failed');}
            hasSession = true;
            return reply(run, scenario === 'failed' ? 502 : 200, scenario === 'failed' ? '对话服务超时，已保存工具结果' : '分析已保存', scenario === 'failed' ? 'error' : 'ready');
        }
        if (path === '/api/agent/proposals/confirm' && request.method() === 'POST') {
            confirmations.push(request.postDataJSON());
            run = {...run, status: 'completed', proposals: run.proposals.map(proposal => ({...proposal, status: 'published', publishedTagId: 'fixture-published-tag'}))};
            return reply(run);
        }
        return reply([]);
    });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.goto(baseURL + '/dashboard/agent');
    await expect(page.getByTestId('agent-workspace')).toBeVisible();
    await expect(page.getByText(scenario === 'unconfigured' ? '助手暂未配置，当前可查看已保存结果' : '助手已就绪，可查询经营数据并提出风险标签草稿', {exact: true})).toBeVisible();
    return {context, page, writes, confirmations, runtimeErrors};
}
async function selectSaved(page) {
    await page.getByLabel('Agent会话', {exact: true}).click();
    await page.locator('.ant-select-item-option').filter({hasText: '验收出勤分析'}).click();
    await expect(page.getByTestId('agent-run-details')).toBeVisible();
}
const checks = [];
try {
    const operator = await setup();
    await expect(operator.page.getByLabel('Agent数据集', {exact: true})).toBeEnabled();
    await operator.page.getByLabel('Agent问题', {exact: true}).fill('核查出勤并提出关注标签');
    await operator.page.getByRole('button', {name: '发送Agent问题', exact: true}).click();
    await expect(operator.page.getByTestId('agent-run-details')).toBeVisible();
    assert.equal(operator.writes.length, 1);
    assert.deepEqual(Object.keys(operator.writes[0]).sort(), ['datasetId', 'message', 'requestKey', 'scope']);
    assert.equal(operator.writes[0].datasetId, ids.dataset);
    assert.ok(!('organizationId' in operator.writes[0].scope));
    await expect(operator.page.getByLabel('Agent数据集', {exact: true})).toBeDisabled();
    await expect(operator.page.getByTestId('agent-facts')).toContainText('76.25');
    await expect(operator.page.getByTestId('agent-facts')).toContainText('数据不足');
    await expect(operator.page.getByTestId('agent-evidence')).toContainText('验收计算批次');
    await expect(operator.page.getByRole('button', {name: '新建Agent会话', exact: true})).toBeEnabled();
    if (screenshotDir) await operator.page.screenshot({path: join(screenshotDir, 'agent-results.png'), fullPage: true, animations: 'disabled'});
    await operator.page.getByRole('button', {name: '确认发布 验收关注标签 v2', exact: true}).click();
    await expect(operator.page.getByRole('dialog')).toContainText('18 名学员');
    await expect(operator.page.getByRole('dialog')).toBeVisible();
    if (screenshotDir) await operator.page.getByRole('dialog').screenshot({path: join(screenshotDir, 'agent-confirmation.png'), animations: 'disabled'});
    assert.equal(operator.confirmations.length, 0);
    await operator.page.getByRole('button', {name: '返回核对', exact: true}).click();
    assert.equal(operator.confirmations.length, 0);
    await operator.page.getByRole('button', {name: '确认发布 验收关注标签 v2', exact: true}).click();
    await operator.page.getByRole('button', {name: '确认发布此版本', exact: true}).click();
    await expect(operator.page.getByRole('dialog')).toBeHidden();
    assert.deepEqual(operator.confirmations, [{runId: ids.run, proposalId: ids.proposal, version: 2, previewToken: ids.token}]);
    await expect(operator.page.getByRole('link', {name: '前往风险工作台建立人群', exact: true})).toHaveAttribute('href', '/dashboard/tags/risk?proposalId=' + ids.proposal);
    await operator.page.getByRole('button', {name: '新建Agent会话', exact: true}).click();
    await expect(operator.page.getByLabel('Agent数据集', {exact: true})).toBeEnabled();
    assert.deepEqual(operator.runtimeErrors, []);
    checks.push('新会话/固定范围/指标与未知/人工确认精确参数/风险人群入口');
    await operator.context.close();

    const viewer = await setup({role: 'viewer', saved: true});
    await selectSaved(viewer.page);
    await expect(viewer.page.getByLabel('Agent问题', {exact: true})).toHaveCount(0);
    await expect(viewer.page.getByRole('button', {name: '新建Agent会话', exact: true})).toBeDisabled();
    await expect(viewer.page.getByRole('button', {name: '确认发布 验收关注标签 v2', exact: true})).toBeDisabled();
    assert.equal(viewer.writes.length + viewer.confirmations.length, 0);
    assert.deepEqual(viewer.runtimeErrors, []);
    checks.push('viewer仅查看已保存会话，无写请求');
    await viewer.context.close();

    const foreign = await setup({saved: true, editable: false});
    await selectSaved(foreign.page);
    await expect(foreign.page.getByLabel('Agent问题', {exact: true})).toBeDisabled();
    await expect(foreign.page.getByText('此会话当前仅可查看，请新建会话继续提问', {exact: true})).toBeVisible();
    await expect(foreign.page.getByRole('button', {name: '确认发布 验收关注标签 v2', exact: true})).toBeEnabled();
    assert.equal(foreign.writes.length + foreign.confirmations.length, 0);
    assert.deepEqual(foreign.runtimeErrors, []);
    checks.push('operator查看他人会话禁发续问，仍允许明确人工确认');
    await foreign.context.close();

    const unconfigured = await setup({scenario: 'unconfigured', saved: true});
    await selectSaved(unconfigured.page);
    await expect(unconfigured.page.getByLabel('Agent问题', {exact: true})).toBeDisabled();
    await expect(unconfigured.page.getByTestId('agent-facts')).toContainText('76.25');
    assert.deepEqual(unconfigured.runtimeErrors, []);
    checks.push('未配置仍可查看保存结果，禁发新请求');
    await unconfigured.context.close();

    const failed = await setup({scenario: 'failed'});
    await failed.page.getByLabel('Agent问题', {exact: true}).fill('核查出勤');
    await failed.page.getByRole('button', {name: '发送Agent问题', exact: true}).click();
    await expect(failed.page.getByTestId('agent-run-details')).toContainText('执行失败');
    await expect(failed.page.getByTestId('agent-facts')).toContainText('76.25');
    await expect(failed.page.getByTestId('agent-proposals')).toContainText('验收关注标签');
    assert.equal(failed.confirmations.length, 0);
    assert.deepEqual(failed.runtimeErrors, []);
    checks.push('HTTP502保留工具事实、草稿和失败原因');
    await failed.context.close();

    const retry = await setup({scenario: 'network_retry'});
    await retry.page.getByLabel('Agent问题', {exact: true}).fill('核查出勤');
    await retry.page.getByRole('button', {name: '发送Agent问题', exact: true}).click();
    await expect(retry.page.getByTestId('agent-error')).toContainText('连接失败');
    await retry.page.getByRole('button', {name: '发送Agent问题', exact: true}).click();
    await expect(retry.page.getByTestId('agent-run-details')).toBeVisible();
    assert.equal(retry.writes.length, 2);
    assert.equal(retry.writes[0].requestKey, retry.writes[1].requestKey);
    assert.deepEqual(retry.runtimeErrors, []);
    checks.push('网络失败重试复用requestKey避免重复执行');
    await retry.context.close();

    console.log(JSON.stringify({status: 'passed', mode: '隔离UI fixtures，不替代真实API链路验收', checks}, null, 2));
} finally {await browser.close();}


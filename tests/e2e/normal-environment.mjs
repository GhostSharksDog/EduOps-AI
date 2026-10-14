// 最终正常环境抽核：只使用已存在账号，不读取配置文件，不写入业务数据或执行模型。
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

const base = process.env.LOCAL_QA_BASE_URL ?? 'http://localhost:3000';
if (base !== 'http://localhost:3000') throw Error('正常环境抽核只允许 http://localhost:3000');
const username = process.env.LOCAL_QA_USERNAME;
const password = process.env.LOCAL_QA_PASSWORD;
if (!username || !password) throw Error('请通过 LOCAL_QA_USERNAME / LOCAL_QA_PASSWORD 传入已有账号；工具不会创建或修改账号');
const artifactDirectory = resolve(process.env.LOCAL_QA_ARTIFACT_DIR ?? 'tests/artifacts/full-public-learning-qa/normal-environment');
await mkdir(artifactDirectory, {recursive: true});

const publicId = '16dcb06e-e875-4efc-a443-3c88a7372585';
const simulationId = 'd515908e-a788-4648-ad6f-ecdd515539b6';
const expectedMetrics = {
    student_count: 28785, enrollment_count: 32593, activity_count: 10655280,
    click_count: 39605099, active_student_count: 26074,
    average_active_days: 55.48, average_score: 75.82, withdrawal_count: 10072,
};
const expectedRows = {
    oulad_course: 22, oulad_student: 32593, oulad_registration: 32593,
    oulad_assessment: 206, oulad_resource: 6364,
    oulad_submission: 173912, oulad_activity: 10655280,
};
const viewports = [[1920, 1080], [1440, 900], [1366, 768], [390, 844]];
const checks = [], screenshots = [], pageErrors = [], blockedRequests = [];
const overviewReplies = [];
let browser, context, loginRequests = 0, token, cutoffText;
const pass = (name, details = {}) => checks.push({name, passed: true, ...details});
const clean = value => String(value).replaceAll(password, '[已隐去]').replaceAll(username, '[已有账号]').slice(0, 500);
const learningLink = path => base + path + '?' + new URLSearchParams({datasetId: publicId, learningScope: JSON.stringify({courseKeys: []})});
const businessScope = {startDate: '2026-08-01', endDate: '2026-08-31', campusIds: [], courseIds: ['sim:course:1'], channelIds: []};
const businessLink = (path, scope) => base + path + '?' + new URLSearchParams({datasetId: simulationId, scope: JSON.stringify(scope)});

function allowed(method, url) {
    if (url.origin !== base) return false;
    if (method === 'GET' || method === 'HEAD') return true;
    if (method !== 'POST') return false;
    return ['/api/auth/login', '/api/overview/query', '/api/analytics/learning/query', '/api/analytics/query'].includes(url.pathname);
}
async function request(path, body, expectedStatus = 200) {
    const method = body === undefined ? 'GET' : 'POST';
    assert.ok(allowed(method, new URL(base + path)), '抽核工具不得调用写接口');
    const response = await context.request.fetch(base + path, {
        method, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
        ...(body === undefined ? {} : {data: body}), timeout: 150000,
    });
    assert.equal(response.status(), expectedStatus, method + ' ' + path + ' 返回状态');
    return response.json();
}
async function screenshot(page, name, fullPage = true) {
    const file = name + '.png';
    await page.screenshot({path: resolve(artifactDirectory, file), fullPage});
    screenshots.push(file);
}
async function noOverflow(page, name) {
    const size = await page.evaluate(() => ({viewport: innerWidth, document: document.documentElement.scrollWidth}));
    assert.ok(size.document <= size.viewport + 2, name + ' 横向溢出 ' + JSON.stringify(size));
}
async function sizes(page, prefix, validate = async () => {}) {
    for (const [width, height] of viewports) {
        await page.setViewportSize({width, height});
        await page.waitForTimeout(400);
        await validate(width, height);
        await noOverflow(page, prefix + ' ' + width);
        await screenshot(page, prefix + '-' + width + 'x' + height);
    }
}
function verifyPublic(board) {
    assert.equal(board.analysisType, 'learning');
    assert.equal(board.dataset.id, publicId);
    assert.equal(board.scope.relativeDayStart, -365);
    assert.equal(board.scope.relativeDayEnd, 608);
    assert.ok(!('startDate' in board.scope));
    assert.equal(board.metrics.length, 8);
    for (const metric of board.metrics) {
        assert.ok(Object.hasOwn(expectedMetrics, metric.code), '公开模式不得返回经营指标');
        assert.equal(metric.value, expectedMetrics[metric.code], metric.code + ' 与已独立核验全量数字一致');
        assert.equal(metric.status, 'ready');
    }
    assert.equal(board.completeness.length, 7);
    for (const file of board.completeness) {
        assert.equal(file.status, 'complete', file.kind + ' 全量完成');
        assert.equal(file.rows, expectedRows[file.kind], file.kind + ' 完成行数');
        assert.equal(file.expected, expectedRows[file.kind], file.kind + ' 预期行数');
    }
    assert.equal(board.completeness.reduce((total, file) => total + file.rows, 0), 10900970);
    assert.ok(board.evidence.length > 0 && board.evidence.every(item => item.learningScope && !item.scope));
    assert.ok(!('analysis' in board));
}
try {
    browser = await chromium.launch({channel: 'msedge', headless: true});
    context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai'});
    // 双重防护：即使界面意外调用写操作，也会在发送前被阻断。
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!allowed(request.method(), url)) {
            blockedRequests.push({method: request.method(), path: url.pathname});
            await route.abort('blockedbyclient'); return;
        }
        if (request.method() === 'POST' && url.pathname === '/api/auth/login') {
            loginRequests++;
            if (loginRequests > 1) {blockedRequests.push({method: 'POST', path: '/api/auth/login', reason: '禁止重复登录'}); await route.abort('blockedbyclient'); return;}
        }
        await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', error => pageErrors.push(clean(error.message)));
    page.on('response', response => {
        if (response.url() === base + '/api/overview/query' && response.request().method() === 'POST') {
            void response.json().then(body => overviewReplies.push(body.data)).catch(() => {});
        }
    });
    await page.goto(base + '/auth/login', {waitUntil: 'networkidle'});
    await page.getByRole('heading', {name: '教培运营分析辅助系统', exact: true}).waitFor();
    assert.equal(await page.getByLabel('用户名', {exact: true}).getAttribute('autocomplete'), 'username');
    assert.equal(await page.getByLabel('密码', {exact: true}).getAttribute('autocomplete'), 'current-password');
    await sizes(page, 'login');
    pass('最新版登录页四种尺寸、无横向溢出、密码管理器属性');
    await page.setViewportSize({width: 1440, height: 900});
    await page.getByLabel('用户名', {exact: true}).fill(username);
    await page.getByLabel('密码', {exact: true}).fill(password);
    await page.getByLabel('密码', {exact: true}).press('Enter');
    await page.waitForURL('**/dashboard');
    token = await page.evaluate(() => localStorage.getItem('auth_token'));
    assert.ok(token, '既有账号应能真实登录');
    assert.equal(loginRequests, 1);
    pass('仅一次真实UI登录，使用已有账号，未创建或修改账号');

    const datasets = (await request('/api/education/datasets')).data;
    const publicDataset = datasets.find(dataset => dataset.id === publicId);
    const simulation = datasets.find(dataset => dataset.id === simulationId);
    assert.equal(publicDataset?.key, 'oulad-v1'); assert.equal(publicDataset.origin, 'public');
    assert.equal(simulation?.key, 'training-sim-20261009-v3'); assert.equal(simulation.origin, 'simulated');
    assert.match(publicDataset.license, /CC BY 4\.0/);
    businessScope.dataCutoff = simulation.dataCutoff;
    cutoffText = await page.evaluate(cutoff => {
        const date = new Date(cutoff), pad = value => String(value).padStart(2, '0');
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
    }, simulation.dataCutoff);

    await page.goto(learningLink('/dashboard'), {waitUntil: 'networkidle'});
    const metrics = page.getByTestId('learning-dashboard').locator('.metric-card');
    await metrics.first().waitFor(); await page.locator('.business-chart svg').first().waitFor();
    const publicBoard = overviewReplies.findLast(board => board?.analysisType === 'learning');
    verifyPublic(publicBoard);
    pass('正常项目库七表全量及八项学习数字、来源许可、相对日和批次证据', {
        dataset: publicDataset.key, totalCompletedRows: 10900970,
        learningMetrics: expectedMetrics, relativeDayBounds: [-365, 608],
        completedBatches: publicBoard.batches.length,
    });
    await sizes(page, 'learning-overview', async (width, height) => {
        assert.equal(await metrics.count(), 8);
        if (width === 1440) {
            const bottoms = await metrics.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().bottom));
            assert.ok(Math.max(...bottoms) < height, '1440×900首屏八项学习指标应全部可见');
            await screenshot(page, 'learning-firstscreen', false);
        }
    });
    await page.setViewportSize({width: 1440, height: 900});
    await metrics.nth(2).click(); await page.getByRole('dialog').waitFor();
    const metricText = await page.getByRole('dialog').innerText();
    assert.ok(metricText.includes('10,655,280') && metricText.includes('相对日'));
    await screenshot(page, 'learning-metric-evidence');
    await page.getByRole('dialog').locator('.ant-modal-close').click();
    await page.locator('.business-chart details > summary').first().click();
    assert.equal(await page.locator('.business-chart details').first().locator('table').isVisible(), true);
    await page.locator('.business-chart details > summary').first().click();
    pass('正常全量学习总览四种尺寸、八卡首屏、事实卡口径证据及图表数据表');

    const knowledge = (await request('/api/knowledge/sources')).data;
    assert.equal(knowledge.length, 9, '九份首期材料保留为草稿');
    assert.ok(knowledge.every(source => source.status === 'draft' && source.approvedAt === null));
    pass('九份知识材料为待人工审核草稿，未执行审核或向量索引', {sources: knowledge.length, drafts: 9});
    await request('/api/overview/query', {datasetId: publicId, learningScope: {courseKeys: []}, scope: businessScope}, 400);
    await request('/api/overview/query', {datasetId: publicId, scope: businessScope}, 400);
    await request('/api/overview/query', {datasetId: simulationId, learningScope: {courseKeys: []}}, 400);
    pass('正常项目的查询范围互斥，公开学习与模拟经营不能串用');

    await page.goto(learningLink('/dashboard/agent'), {waitUntil: 'networkidle'});
    await page.getByRole('heading', {name: /Agent学习分析助手/}).waitFor();
    await page.getByLabel('学习起始相对日', {exact: true}).waitFor();
    assert.equal(await page.getByLabel('Agent开始日期', {exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: '续费跟进', exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: '运营标签工作台', exact: true}).count(), 0);
    await sizes(page, 'learning-agent');
    pass('正常公开Agent四种尺寸仅学习范围，无经营标签入口，未提交模型问答');

    await page.goto(businessLink('/dashboard', businessScope), {waitUntil: 'networkidle'});
    await page.locator('.metric-card').first().waitFor();
    assert.equal(await page.getByTestId('learning-dashboard').count(), 0);
    const businessBoard = overviewReplies.findLast(board => board?.analysis?.dataset?.origin === 'simulated');
    assert.equal(businessBoard.analysis.dataset.id, simulationId);
    assert.equal(businessBoard.analysis.metrics.length, 8);
    assert.ok(businessBoard.analysis.metrics.every(metric => !Object.hasOwn(expectedMetrics, metric.code)));
    await sizes(page, 'business-overview');
    pass('正常第三版模拟经营总览八项业务指标、来源独立和四尺寸', {dataset: simulation.key, businessMetricCount: 8});

    await page.goto(businessLink('/dashboard/agent', businessScope), {waitUntil: 'networkidle'});
    await page.getByLabel('Agent开始日期', {exact: true}).waitFor();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Agent开始日期"]')?.value === '2026-08-01');
    await sizes(page, 'business-agent-dates', async () => {
        for (const [label, expected] of [['Agent开始日期', '2026-08-01'], ['Agent结束日期', '2026-08-31']]) {
            const input = page.getByLabel(label, {exact: true});
            assert.equal(await input.inputValue(), expected);
            const dimensions = await input.evaluate(element => ({width: element.clientWidth, scroll: element.scrollWidth}));
            assert.ok(dimensions.width >= dimensions.scroll, label + ' YYYY-MM-DD 完整显示');
        }
        assert.equal(await page.getByLabel('Agent数据截止时间', {exact: true}).inputValue(), cutoffText);
    });
    pass('正常业务Agent四种尺寸完整起止日期及截止时间，未提交问答或发布');
    assert.deepEqual(pageErrors, [], '最新版真实页面异常');
    assert.deepEqual(blockedRequests, [], '界面不得触发写接口或外部调用');
    pass('正常环境抽核未触发Agent、发布、审核、导入或其他业务写接口');
    await writeFile(resolve(artifactDirectory, 'verification.json'), JSON.stringify({
        verifiedAt: new Date().toISOString(), base, readOnlyBusinessVerification: true,
        existingAccountUsed: true, loginRequests, checks, screenshots, pageErrors, blockedRequests,
        publicDatasetId: publicId, simulationDatasetId: simulationId,
    }, null, 2) + '\n');
    console.log(JSON.stringify({passedGroups: checks.length, screenshots: screenshots.length, artifactDirectory, pageErrors, businessWrites: 0}, null, 2));
} catch (failure) {
    await writeFile(resolve(artifactDirectory, 'failure.json'), JSON.stringify({failedAt: new Date().toISOString(), message: clean(failure.message), checks, screenshots, pageErrors, blockedRequests}, null, 2) + '\n');
    throw Error(clean(failure.message));
} finally {token = undefined; if (browser) await browser.close();}

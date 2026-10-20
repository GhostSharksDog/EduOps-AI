// 正常项目的只读视觉验收：只使用已有账号和对象，不发送模型请求或正式业务写入。
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {config} from 'dotenv';
import pg from 'pg';
import {SignJWT} from 'jose';
import {chromium} from '@playwright/test';

const base = 'http://localhost:3000';
const env = {...process.env};
config({path: [resolve('.env.local'), resolve('.env')], processEnv: env, quiet: true});
const connection = new URL(env.DATABASE_URL ?? '');
assert.ok(['127.0.0.1', 'localhost'].includes(connection.hostname)
    && connection.port === '15434' && connection.pathname === '/metadata_dev', '只允许正常项目只读复核');
assert.ok(env.JWT_SECRET?.length >= 32, '已有登录配置未就绪');
const dir = resolve(env.LOCAL_QA_ARTIFACT_DIR ?? 'tests/artifacts/editorial-qa/production');
const companyCode = env.LOCAL_QA_COMPANY_CODE ?? env.DEFAULT_COMPANY_CODE ?? 'main';
const registry = env.COMPANY_REGISTRY_JSON ? JSON.parse(env.COMPANY_REGISTRY_JSON) : [{
    code: 'main', organizationId: env.SYSTEM_USER_ID || '6f40f555-5f1b-4d1f-807c-b209e817bfdd', databaseUrlEnv: 'DATABASE_URL',
}];
assert.ok(Array.isArray(registry), '公司注册表格式必须正确');
const registeredCompany = registry.find(company => company.code === companyCode);
assert.ok(registeredCompany, '验收公司必须明确登记');
const companyConnection = new URL(env[registeredCompany.databaseUrlEnv] ?? '');
assert.ok(['127.0.0.1', 'localhost'].includes(companyConnection.hostname)
    && companyConnection.port === '15434' && companyConnection.pathname === '/metadata_dev', '公司必须连接原正常项目库');
const organizationId = registeredCompany.organizationId.toLowerCase();
const sizes = [[1920, 1080], [1440, 900], [1366, 768], [390, 844]];
const readOnlyPosts = new Set([
    '/api/overview/query', '/api/overview/journey/query', '/api/analytics/query',
    '/api/analytics/learning/query', '/api/analytics/finance/query',
    '/api/analytics/channels/catalog', '/api/analytics/channels/query',
    '/api/profiles/search', '/api/agent/research/compare',
]);
const inventoryPaths = ['/api/education/datasets', '/api/tags/proposals', '/api/segments/risk-snapshots',
    '/api/reports', '/api/decisions', '/api/knowledge/sources'];
const checks = [], screenshots = [], blocked = [], browserErrors = [], httpErrors = [];
let browser, context, page, anonymous, loginPage, inventoryBefore, inventoryAfter, latestRun, failedRun;
let currentStep = '准备已有账号的短时只读会话';
await mkdir(dir, {recursive: true});

function pass(name, details) {
    checks.push({name, passed: true, ...(details ? {details} : {})});
    console.log('通过：' + name);
}
function allowed(method, url) {
    return url.origin === base && (method === 'GET' || method === 'HEAD'
        || method === 'POST' && readOnlyPosts.has(url.pathname));
}
async function protectRequests(target) {
    await target.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url());
        if (!allowed(request.method(), url)) {
            blocked.push({method: request.method(), path: url.pathname});
            return route.abort('blockedbyclient');
        }
        return route.continue();
    });
    target.on('page', observePage);
}
function observePage(target) {
    target.setDefaultTimeout(60000);
    target.on('pageerror', error => browserErrors.push({name: error.name, step: currentStep}));
    target.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === base && url.pathname.startsWith('/api/') && response.status() >= 400) {
            httpErrors.push({path: url.pathname, status: response.status(), step: currentStep});
        }
    });
}
async function api(path, input) {
    const method = input === undefined ? 'GET' : 'POST';
    assert.ok(allowed(method, new URL(base + path)), '验收不能调用写入接口');
    const response = await context.request.fetch(base + path, {
        method, headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
        ...(input === undefined ? {} : {data: input}), timeout: 120000,
    });
    assert.equal(response.status(), 200, '只读接口应成功：' + path.split('?')[0]);
    return (await response.json()).data;
}
async function inventory() {
    return Object.fromEntries(await Promise.all(inventoryPaths.map(async path => [path,
        (await api(path)).map(item => ({id: item.id, status: item.status, state: item.state,
            version: item.version, memberCount: item.memberCount})).sort((a, b) => a.id.localeCompare(b.id)),
    ])));
}
async function overflow(target, label) {
    const geometry = await target.evaluate(() => ({viewport: innerWidth, document: document.documentElement.scrollWidth}));
    assert.ok(geometry.document <= geometry.viewport + 2, label + '不能横向溢出');
    return geometry;
}
async function capture(target, name, {fullPage = false} = {}) {
    await target.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    const file = resolve(dir, name + '.png');
    await target.screenshot({path: file, fullPage,
        mask: [target.locator('.header-user-name')], maskColor: '#f5f2ea'});
    screenshots.push(file);
}
async function visit(target, url, ready) {
    await target.goto(url, {waitUntil: 'networkidle', timeout: 120000});
    await target.locator(ready ?? '.business-content').first().waitFor();
    await target.evaluate(() => document.fonts.ready);
}
async function checkFirstScreen(target) {
    assert.equal(await target.locator('.business-sidebar [role="menuitem"]').count(), 4, '保留四个常用入口');
    const cards = target.locator('[data-testid="overview-metrics"] .metric-card');
    assert.equal(await cards.count(), 4, '默认四项重点指标');
    for (const card of await cards.all()) {
        const box = await card.boundingBox();
        assert.ok(box && box.y >= 0 && box.y + box.height <= 900, '四项重点指标应完整进入1440首屏');
    }
    const priority = await target.locator('.priority-card').boundingBox();
    assert.ok(priority && priority.y < 900, '重点事项应进入1440首屏');
    const primary = target.locator('.business-page-header').getByRole('link', {name: /智能分析$/});
    const primaryBox = await primary.boundingBox();
    assert.ok(primaryBox && primaryBox.y + primaryBox.height <= 900, '主要分析入口应进入首屏');
    assert.ok(await target.getByText('模拟经营', {exact: true}).first().isVisible(), '来源性质应明确显示');
}
async function fullInput(target, label, expected) {
    const input = target.getByRole('textbox', {name: label, exact: true});
    assert.equal(await input.inputValue(), expected, label + '必须保留完整日期');
    const size = await input.evaluate(element => ({client: element.clientWidth, scroll: element.scrollWidth}));
    assert.ok(size.client > 0 && size.scroll <= size.client + 2, label + '不能裁切文字');
}
async function setTheme(target, dark) {
    const label = dark ? '切换深色主题' : '切换浅色主题';
    await target.getByRole('button', {name: label, exact: true}).click();
    await target.waitForFunction(expected => document.body.dataset.theme === expected, dark ? 'dark' : 'light');
    assert.equal(await target.evaluate(() => localStorage.getItem('education-theme')), dark ? 'dark' : 'light');
}
async function switchDataset(target, dataset, ready) {
    const select = target.getByRole('combobox', {name: '运营数据集', exact: true});
    await select.focus();
    await select.press('ArrowDown');
    await target.locator('.ant-select-dropdown:visible .ant-select-item-option')
        .filter({hasText: dataset.name}).first().click();
    await target.locator(ready).first().waitFor({timeout: 120000});
    await target.waitForFunction(id => new URLSearchParams(location.search).get('datasetId') === id, dataset.id);
}
async function checkMetricDisplay(target, data, mode) {
    const cards = target.locator('.business-content .metric-grid .metric-card');
    await cards.first().waitFor({timeout: 120000});
    assert.equal(await cards.count(), data.metrics.length, '指标数量与程序查询结果一致');
    for (let index = 0; index < data.metrics.length; index++) {
        const metric = data.metrics[index], card = cards.nth(index);
        const numeric = mode === 'learning' ? card.locator('.metric-number')
            : card.locator('.ant-card-body > div').first();
        const known = metric.value !== null && (mode !== 'learning' || metric.status === 'ready');
        const value = mode === 'finance' && metric.unit === '元' ? metric.value / 1e8 : metric.value;
        const expected = known ? value.toLocaleString('zh-CN', {maximumFractionDigits: 2}) : '—';
        const unit = mode === 'finance' ? metric.unit === '元' ? '亿元' : '%'
            : metric.status === 'ready' ? metric.unit : '';
        assert.equal((await numeric.textContent()).replace(/\s/g, ''), (expected + unit).replace(/\s/g, ''),
            '大数字、未知值与单位必须保持真实且完整');
        const geometry = await numeric.evaluate(element => ({client: element.clientWidth, scroll: element.scrollWidth}));
        assert.ok(geometry.client > 0 && geometry.scroll <= geometry.client + 2, '大数字与单位不能在卡片中横向裁切');
    }
}

let user, token;
try {
    const db = new pg.Client({connectionString: connection.toString()});
    await db.connect();
    try {
        await db.query('BEGIN READ ONLY');
        user = (await db.query('SELECT id, username, role, organization_id AS "ownedBy" FROM local_user WHERE enabled=true AND organization_id=$1::uuid ORDER BY CASE role WHEN \'admin\' THEN 0 ELSE 1 END, id LIMIT 1', [organizationId])).rows[0];
        assert.ok(user, '需要已有启用账号，不创建验收账号');
        // 只读取执行编号、范围和事实数量，不读取账号密码、问题、回答正文或模型审计输入。
        const executions = (await db.query(`SELECT e.id, e.status, s."datasetId", s.scope,
            jsonb_array_length(COALESCE(e.answer->'facts', '[]'::jsonb)) AS "factCount",
            jsonb_array_length(e.evidence) AS "evidenceCount"
            FROM agent_execution e JOIN agent_session s ON s.id=e."sessionId"
            WHERE e."organizationId"=$1::uuid AND e."createdBy"=$2::uuid
            AND e.status IN ('completed','failed') ORDER BY e."startedAt" DESC`, [organizationId, user.id])).rows;
        latestRun = executions.find(row => row.status === 'completed' && row.factCount > 0 && row.scope.startDate)
            ?? executions.find(row => row.id === '3bcb5c82-9a0b-42a2-830d-4cdf7ded985f');
        failedRun = executions.find(row => row.status === 'failed' && row.factCount === 42 && row.scope.startDate);
        assert.ok(latestRun, '需要已有成功的经营分析记录');
        assert.ok(failedRun, '需要保留42项事实的既有失败记录');
        await db.query('COMMIT');
    } finally {await db.end();}
    const companyResponse = await fetch(base + '/api/auth/companies');
    assert.equal(companyResponse.status, 200, '公司目录必须可用');
    const companyBody = await companyResponse.json();
    assert.deepEqual(Object.keys(companyBody).sort(), ['companies', 'defaultCompanyCode'], '公司目录采用直接公开响应，不是data封装');
    assert.ok(Array.isArray(companyBody.companies) && typeof companyBody.defaultCompanyCode === 'string');
    for (const item of companyBody.companies) assert.deepEqual(Object.keys(item).sort(), ['code', 'name'], '公开公司目录不能包含连接信息');
    const company = companyBody.companies?.find(item => item.code === companyCode);
    assert.ok(company, '公司必须已登记');
    assert.equal(user.ownedBy, organizationId, 'JWT机构必须匹配所选公司的实际账号');
    user = {...user, realName: '本地账号', email: '', companyCode, companyName: company.name};
    token = await new SignJWT(user).setProtectedHeader({alg: 'HS256'}).setIssuedAt().setExpirationTime('20m')
        .sign(new TextEncoder().encode(env.JWT_SECRET));
    browser = await chromium.launch({channel: 'msedge', headless: true});
    context = await browser.newContext({viewport: {width: 1440, height: 900}, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce'});
    await protectRequests(context);
    await context.addInitScript(({token, user}) => {
        if (location.origin !== 'http://localhost:3000') return;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        if (!localStorage.getItem('education-theme')) localStorage.setItem('education-theme', 'light');
    }, {token, user});
    page = await context.newPage();
    inventoryBefore = await inventory();
    const datasets = await api('/api/education/datasets');
    const simulation = datasets.find(item => item.schemaVersion === '3' && item.origin === 'simulated');
    const learning = datasets.find(item => item.analysisType === 'learning' || item.key === 'oulad-v1');
    const finance = datasets.find(item => item.analysisType === 'finance');
    assert.ok(simulation, '第三版模拟数据必须保留');
    assert.ok(learning && finance, '公开学习与年度财务数据必须保留');
    const prior = JSON.parse(await readFile(resolve('tests/artifacts/decision-qa/normal-flows-progress.json'), 'utf8'));
    const flows = [];
    currentStep = '核对两条已有的46／38人冻结流程';
    for (const saved of prior.flows) {
        const snapshot = await api('/api/segments/risk-snapshots/' + saved.snapshotId);
        const proposal = await api('/api/tags/proposals/' + saved.proposalId);
        const task = await api('/api/decisions/' + saved.taskId);
        assert.equal(snapshot.memberCount, saved.memberCount, '历史冻结人数不得改变');
        assert.equal(proposal.status, 'published', '保留历史发布状态');
        assert.equal(task.state, 'completed', '保留历史完成状态');
        const {organizationId: ignoredOrganization, authorizedCampusIds, ...scope} = snapshot.preview.scope;
        void ignoredOrganization; void authorizedCampusIds;
        flows.push({...saved, scope});
    }
    assert.deepEqual(flows.map(flow => flow.memberCount), [46, 38]);
    pass(currentStep);
    const first = flows[0];
    const link = (path, scope = first.scope, extra = {}, datasetId = simulation.id) => base + path + '?' + new URLSearchParams({datasetId, scope: JSON.stringify(scope), ...extra});
    const agentLink = link('/dashboard/agent', latestRun.scope, {runId: latestRun.id}, latestRun.datasetId);
    const pages = [
        ['overview', link('/dashboard'), '[data-testid="overview-metrics"] .metric-card'],
        ['agent', agentLink, '[data-testid="agent-run-details"]'],
        ['tag', link('/dashboard/tags/risk', first.scope, {proposalId: first.proposalId}), '.ant-steps'],
        ['segments', link('/dashboard/segments/risk'), '.ant-table'],
        ['profile', link('/dashboard/data/portrait', first.scope, {snapshotId: first.snapshotId}), '.profile-stat'],
        ['decision', link('/dashboard/decisions', first.scope), '[aria-label="任务与反馈"] .ant-table'],
        ['report', link('/dashboard/reports/' + first.reportId), 'article [aria-label="关键数字"]'],
        ['knowledge', base + '/dashboard/knowledge', '.business-content .ant-table'],
        ['help', base + '/dashboard/help', '.business-content .ant-card'],
    ];
    currentStep = '1440首屏导航、四指标、重点事项与主要入口';
    await visit(page, link('/dashboard'), '[data-testid="overview-metrics"] .metric-card');
    await checkFirstScreen(page);
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    pass(currentStep);
    currentStep = '四尺寸核心页面只读截图';
    for (const [width, height] of sizes) {
        await page.setViewportSize({width, height});
        for (const [name, href, ready] of pages) {
            currentStep = name + ' · ' + width + 'px';
            await visit(page, href, ready);
            await overflow(page, currentStep);
            if (name === 'agent') {
                assert.ok(await page.locator('[data-testid="agent-facts"] .profile-stat').count() <= 3);
                assert.ok(await page.locator('[data-testid="agent-frozen-scope"]').isVisible());
            }
            await capture(page, name + '-' + width);
        }
    }
    pass('九个核心页面四尺寸截图与无横向溢出');
    currentStep = '学习与财务数据切换、大数字单位和双尺寸只读截图';
    const learningData = await api('/api/overview/query', {datasetId: learning.id, learningScope: {courseKeys: []}});
    const financeData = await api('/api/overview/query', {datasetId: finance.id, financeScope: {years: []}});
    assert.ok(learningData.metrics.some(metric => metric.code === 'activity_count' && metric.value >= 1000000),
        '公开学习模式应展示已完成导入的百万级真实来源记录');
    assert.ok(financeData.metrics.some(metric => metric.unit === '元' && metric.value >= 100000000),
        '年度财务需要真实大金额以验证亿元显示');
    for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({width, height});
        await visit(page, link('/dashboard'), '[data-testid="overview-metrics"] .metric-card');
        await switchDataset(page, learning, '[data-testid="learning-dashboard"] .metric-card');
        assert.ok(await page.getByText('公开匿名 · CC BY 4.0', {exact: true}).isVisible());
        assert.ok(await page.getByText('匿名公开学习', {exact: true}).first().isVisible());
        let params = new URL(page.url()).searchParams;
        assert.ok(params.has('learningScope') && !params.has('scope') && !params.has('financeScope'), '学习范围不套用经营日期或财务年度');
        await checkMetricDisplay(page, learningData, 'learning');
        await overflow(page, '公开学习' + width);
        await capture(page, 'learning-' + width);
        await switchDataset(page, finance, '.business-content .metric-grid .metric-card');
        await page.getByText('公开真实 · 集团年度', {exact: true}).waitFor();
        assert.ok(await page.getByText('真实年度财务案例', {exact: true}).isVisible());
        params = new URL(page.url()).searchParams;
        assert.ok(params.has('financeScope') && !params.has('scope') && !params.has('learningScope'), '财务范围只使用年度');
        await checkMetricDisplay(page, financeData, 'finance');
        await overflow(page, '年度财务' + width);
        await capture(page, 'finance-' + width);
        await switchDataset(page, simulation, '[data-testid="overview-metrics"] .metric-card');
        params = new URL(page.url()).searchParams;
        assert.ok(params.has('scope') && !params.has('learningScope') && !params.has('financeScope'), '切回经营范围后无公开来源混算');
    }
    pass(currentStep, {learningMetricCount: learningData.metrics.length, financeMetricCount: financeData.metrics.length});
    currentStep = 'Agent开始、结束、截止时间显示完整';
    for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({width, height});
        await visit(page, agentLink, '[data-testid="agent-run-details"]');
        await page.getByRole('button', {name: '修改范围', exact: true}).click();
        const drawer = page.getByRole('dialog', {name: '修改分析范围', exact: true});
        await drawer.waitFor();
        await fullInput(drawer, 'Agent开始日期', latestRun.scope.startDate);
        await fullInput(drawer, 'Agent结束日期', latestRun.scope.endDate);
        const cutoff = drawer.getByRole('textbox', {name: 'Agent数据截止时间', exact: true});
        if (latestRun.scope.dataCutoff) {
            assert.match(await cutoff.inputValue(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
            const geometry = await cutoff.evaluate(element => ({client: element.clientWidth, scroll: element.scrollWidth}));
            assert.ok(geometry.scroll <= geometry.client + 2, '截止时间不得裁切');
        }
        await capture(page, 'agent-range-' + width);
        await drawer.getByRole('button', {name: /取\s*消/}).click();
        await drawer.waitFor({state: 'hidden'});
    }
    pass(currentStep);
    currentStep = '42项事实的失败记录仍可阅读与恢复';
    await visit(page, link('/dashboard/agent', failedRun.scope, {runId: failedRun.id}, failedRun.datasetId), '[data-testid="agent-run-details"]');
    await page.getByText('数据已查到，智能解读未完成', {exact: true}).waitFor();
    await page.getByText(/已保留 42 项已核验信息/).waitFor();
    await page.getByRole('link', {name: '重新发送问题', exact: true}).waitFor();
    await page.getByText('查看完整分析 · 数据依据与执行记录', {exact: true}).click();
    await page.getByText('全部事实（42）', {exact: true}).waitFor();
    await page.locator('[data-testid="agent-evidence"]').waitFor();
    await overflow(page, '失败历史');
    await capture(page, 'agent-preserved-failure-390');
    pass(currentStep, {factCount: 42, evidenceCount: failedRun.evidenceCount});
    currentStep = '主题切换、刷新保存和深色页面';
    await page.setViewportSize({width: 1440, height: 900});
    await visit(page, link('/dashboard'), '[data-testid="overview-metrics"] .metric-card');
    await setTheme(page, true);
    await page.reload({waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.body.dataset.theme === 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('education-theme')), 'dark');
    for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({width, height});
        for (const [name, href, ready] of pages.slice(0, 2)) {
            await visit(page, href, ready);
            await page.waitForFunction(() => document.body.dataset.theme === 'dark');
            await overflow(page, '深色' + name);
            await capture(page, name + '-dark-' + width);
        }
    }
    await setTheme(page, false);
    await page.reload({waitUntil: 'networkidle'});
    await page.waitForFunction(() => document.body.dataset.theme === 'light');
    pass(currentStep);
    currentStep = '匿名登录四尺寸、空表单校验和键盘密码显隐';
    anonymous = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
    await protectRequests(anonymous);
    loginPage = await anonymous.newPage();
    for (const [width, height] of sizes) {
        await loginPage.setViewportSize({width, height});
        await visit(loginPage, base + '/auth/login', 'form#local-login');
        await loginPage.getByRole('combobox', {name: '登录公司', exact: true}).waitFor();
        await overflow(loginPage, '登录' + width);
        await capture(loginPage, 'login-' + width);
    }
    // 仅触发客户端空值校验；输入的临时假文字不提交、不截图。
    await loginPage.getByRole('button', {name: /登\s*录/}).click();
    await loginPage.getByText('请输入用户名', {exact: true}).waitFor();
    await loginPage.getByText('请输入密码', {exact: true}).waitFor();
    const password = loginPage.locator('input[autocomplete="current-password"]');
    await password.fill('visual-qa-placeholder');
    const reveal = loginPage.getByRole('button', {name: '显示密码', exact: true});
    await reveal.focus(); await loginPage.keyboard.press('Enter');
    assert.equal(await password.getAttribute('type'), 'text');
    await loginPage.getByRole('button', {name: '隐藏密码', exact: true}).focus();
    await loginPage.keyboard.press('Enter');
    assert.equal(await password.getAttribute('type'), 'password');
    await password.fill('');
    await loginPage.evaluate(() => localStorage.setItem('education-theme', 'dark'));
    for (const [width, height] of [[1440, 900], [390, 844]]) {
        await loginPage.setViewportSize({width, height});
        await visit(loginPage, base + '/auth/login', 'form#local-login');
        await loginPage.waitForFunction(() => document.body.dataset.theme === 'dark');
        await overflow(loginPage, '深色登录' + width);
        await capture(loginPage, 'login-dark-' + width);
    }
    await loginPage.evaluate(() => localStorage.setItem('education-theme', 'light'));
    pass(currentStep);
    currentStep = '原业务清单前后不变且无写入、模型调用或页面错误';
    inventoryAfter = await inventory();
    assert.deepEqual(inventoryAfter, inventoryBefore, '已有业务记录必须保持不变');
    assert.deepEqual(blocked, [], '页面不得尝试写入或调用模型');
    assert.deepEqual(browserErrors, [], '页面不应发生未处理异常');
    assert.deepEqual(httpErrors, [], '只读页面接口不应失败');
    pass(currentStep);
    await writeFile(resolve(dir, 'verification.json'), JSON.stringify({
        testedAt: new Date().toISOString(), readOnly: true,
        authMethod: '已有本地账号的20分钟验收会话；未读取密码、不创建账号',
        modelCalls: 0, sizes, checks, screenshots,
        existingFlows: flows.map(({scenario, memberCount, proposalId, snapshotId, reportId, taskId}) =>
            ({scenario, memberCount, proposalId, snapshotId, reportId, taskId})),
        selectedRuns: {completed: {id: latestRun.id, factCount: latestRun.factCount},
            failed: {id: failedRun.id, factCount: failedRun.factCount}},
        inventoryBefore, inventoryAfter, blocked, browserErrors, httpErrors,
    }, null, 2));
    console.log(JSON.stringify({passed: checks.length, screenshots: screenshots.length, readOnly: true}));
} catch (error) {
    // 不记录问题正文、用户资料、响应体、连接值或认证令牌。
    if (page && !page.isClosed()) await capture(page, 'failure').catch(() => {});
    if (loginPage && !loginPage.isClosed()) {
        await loginPage.locator('input[autocomplete="current-password"]').fill('').catch(() => {});
        await capture(loginPage, 'failure-login').catch(() => {});
    }
    if (context) {try {inventoryAfter = await inventory();} catch {}}
    await writeFile(resolve(dir, 'failure.json'), JSON.stringify({
        testedAt: new Date().toISOString(), readOnly: true, failedStep: currentStep,
        errorType: error.name, code: error.code ?? null, operator: error.operator ?? null,
        stackLocations: String(error.stack ?? '').split('\n').filter(line => line.trimStart().startsWith('at ')).slice(0, 6),
        checks, screenshots, blocked, browserErrors, httpErrors, inventoryBefore, inventoryAfter,
    }, null, 2));
    throw new Error('杂志式界面只读验收未完成，请查看 failure.json 与截图');
} finally {
    await Promise.allSettled([anonymous?.close(), context?.close()]);
    await browser?.close();
}

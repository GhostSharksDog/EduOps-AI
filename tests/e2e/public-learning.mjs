// 集中验收：仅显式本机_test服务。公开学习与模拟经营分别核对，不使用真实账号。
import assert from 'node:assert/strict';
import {randomBytes, randomUUID, scryptSync} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {parse} from 'csv-parse';
import {parse as parseSync} from 'csv-parse/sync';
import pg from 'pg';
import {chromium} from '@playwright/test';

const base = process.env.TEST_BASE_URL ?? '';
const database = new URL(process.env.DATABASE_URL ?? '');
if (!/^http:\/\/127\.0\.0\.1:330[23]$/.test(base) || database.hostname !== '127.0.0.1' || database.port !== '25432' || database.pathname !== '/education_cleanup_test') throw Error('公开学习验收仅允许本机专用_test数据库和3302/3303测试应用');
if (process.env.CLICKHOUSE_PORT !== '28123' || process.env.CLICKHOUSE_DATABASE !== 'education_cleanup_test') throw Error('必须显式指定28123专用ClickHouse测试库');
const qa = process.env.TEST_ARTIFACT_DIR ?? 'tests/artifacts/full-public-learning-qa';
await mkdir(qa, {recursive: true});
const db = new pg.Client({connectionString: database.toString()});
const org = '6f40f555-5f1b-4d1f-807c-b209e817bfdd', password = randomBytes(24).toString('base64url'), stamp = Date.now();
const checks = [], pageErrors = [], screenshots = [];
const browserOnly = process.argv.includes('--browser-only');
const skipLogin = process.argv.includes('--skip-login');
if (skipLogin && !browserOnly) throw Error('跳过登录仅用于本轮浏览器续验');
let requests = 0, browser;
const pass = (name, details = {}) => checks.push({name, passed: true, ...details});
async function request(path, body, actor, expected = 200) {
    requests++;
    const response = await fetch(base + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', ...(actor ? {Authorization: 'Bearer ' + actor.token} : {})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(150000)});
    const result = await response.json();
    assert.equal(response.status, expected, path + ' ' + String(result.message ?? result.error ?? '').slice(0, 180));
    return result;
}
const learningLink = (path, datasetId, learningScope = {courseKeys: []}, extra = {}) => base + path + '?' + new URLSearchParams({datasetId, learningScope: JSON.stringify(learningScope), ...extra});
const operationLink = (path, datasetId, scope) => base + path + '?' + new URLSearchParams({datasetId, scope: JSON.stringify(scope)});
const metricCodes = ['student_count', 'enrollment_count', 'activity_count', 'click_count', 'active_student_count', 'average_active_days', 'average_score', 'withdrawal_count'];
const courseKey = row => row.code_module + ':' + row.code_presentation;
const round = number => Math.round(number * 100) / 100;
async function csv(name) {return parseSync(await readFile('datasets/raw/oulad/' + name, 'utf8'), {columns: true, skip_empty_lines: true});}
async function activitySample(limit) {
    const input = createReadStream('datasets/raw/oulad/studentVle.csv');
    const parser = input.pipe(parse({columns: true, skip_empty_lines: true}));
    const rows = [];
    try {for await (const row of parser) {rows.push(row); if (rows.length >= limit) break;}}
    finally {input.destroy(); parser.destroy();}
    return rows;
}
function independent(scope, source) {
    const selected = row => !scope.courseKeys.length || scope.courseKeys.includes(courseKey(row));
    const day = value => value !== '' && Number(value) >= scope.relativeDayStart && Number(value) <= scope.relativeDayEnd;
    const learners = source.students.filter(selected), activities = source.activities.filter(row => selected(row) && day(row.date)), ids = new Set(source.assessments.filter(selected).map(row => row.id_assessment));
    const eligible = source.submissions.filter(row => ids.has(row.id_assessment) && day(row.date_submitted) && row.is_banked !== '1'), known = eligible.filter(row => row.score !== '' && row.score !== '?' && Number.isFinite(Number(row.score)));
    return {
        student_count: new Set(learners.map(row => row.id_student)).size,
        enrollment_count: learners.length,
        activity_count: activities.length,
        click_count: activities.reduce((sum, row) => sum + Number(row.sum_click), 0),
        active_student_count: new Set(activities.map(row => row.id_student)).size,
        average_active_days: null, // 样本活动未完成全量，完整名册均值必须留空。
        average_score: known.length ? round(known.reduce((sum, row) => sum + Number(row.score), 0) / known.length) : null,
        withdrawal_count: source.registrations.filter(row => selected(row) && day(row.date_unregistration)).length,
    };
}
async function screenshot(page, name, fullPage = true) {
    await page.screenshot({path: qa + '/' + name + '.png', fullPage});
    screenshots.push(name + '.png');
}
async function noOverflow(page, name) {
    const size = await page.evaluate(() => ({width: innerWidth, document: document.documentElement.scrollWidth}));
    assert.ok(size.document <= size.width + 2, name + '不得横向溢出 ' + JSON.stringify(size));
}
try {
    await db.connect();
    assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name, 'education_cleanup_test');
    const accounts = {};
    for (const role of ['admin', 'viewer', 'other']) {
        const username = 'public_qa_' + role + '_' + stamp, salt = randomBytes(16).toString('hex');
        await db.query('INSERT INTO local_user(id,username,password_hash,real_name,role,organization_id,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())', [randomUUID(), username, 'scrypt:' + salt + ':' + scryptSync(password, salt, 64).toString('hex'), '公开学习集中验收', role === 'other' ? 'admin' : role, role === 'other' ? randomUUID() : org]);
        accounts[role] = {...await request('/api/auth/login', {username, password}), username};
    }
    const {admin, viewer, other} = accounts;
    const datasets = (await request('/api/education/datasets', undefined, admin)).data;
    const publicDataset = datasets.find(dataset => dataset.key === 'oulad-v1-sample-20000') ?? datasets.find(dataset => dataset.key === 'oulad-v1');
    const simulation = datasets.find(dataset => dataset.key === 'training-sim-20261009-v3');
    assert.ok(publicDataset, '请先导入OULAD基础表和前2万条活动'); assert.ok(simulation, '请先导入第三版模拟数据');
    const input = {datasetId: publicDataset.id, learningScope: {courseKeys: []}};
    const operationScope = {startDate: '2026-08-01', endDate: '2026-08-31', campusIds: [], courseIds: ['sim:course:1'], channelIds: [], dataCutoff: simulation.dataCutoff};
    if (browserOnly) {
        const previous = JSON.parse(await readFile(qa + '/failure.json', 'utf8'));
        const previousApi = previous.checks.filter(check => !/登录|总览四尺寸|经营Agent|页面异常/.test(check.name));
        assert.equal(previousApi.length, 4, '仅浏览器续验必须已有本轮四组API通过记录');
        checks.push(...previousApi.map(check => ({...check, reusedFromSameRound: true})));
    } else {
    await request('/api/analytics/learning/query', input, undefined, 401);
    await request('/api/analytics/learning/query', input, other, 404);
    await request('/api/analytics/learning/query', {...input, organizationId: org}, admin, 400);
    await request('/api/analytics/learning/query', {...input, learningScope: {courseKeys: ['不存在的课程批次']}}, admin, 400);
    await request('/api/analytics/learning/query', {...input, learningScope: {courseKeys: [], relativeDayStart: 3, relativeDayEnd: -1}}, admin, 400);
    await request('/api/overview/query', {...input, scope: operationScope}, admin, 400);
    await request('/api/overview/query', {datasetId: publicDataset.id, scope: operationScope}, admin, 400);
    await request('/api/overview/query', {datasetId: simulation.id, learningScope: {courseKeys: []}}, admin, 400);
    pass('匿名、机构、未知课程、相对日顺序和两种范围严格隔离');

    const board = (await request('/api/overview/query', input, viewer)).data;
    assert.equal(board.analysisType, 'learning'); assert.deepEqual(board.metrics.map(metric => metric.code), metricCodes);
    assert.equal(board.metrics.find(metric => metric.code === 'activity_count').value, 20000);
    assert.equal(board.completeness.length, 7); assert.equal(board.completeness.find(row => row.kind === 'oulad_activity').status, 'partial');
    assert.equal(board.metrics.find(metric => metric.code === 'average_active_days').value, null);
    assert.ok(!('analysis' in board)); assert.ok(board.evidence.every(item => item.learningScope && !item.scope));
    const source = {};
    [source.students, source.registrations, source.assessments, source.submissions, source.activities] = await Promise.all([csv('studentInfo.csv'), csv('studentRegistration.csv'), csv('assessments.csv'), csv('studentAssessment.csv'), activitySample(20000)]);
    const expected = independent(board.scope, source);
    for (const metric of board.metrics) assert.equal(metric.value, expected[metric.code], '独立原始CSV核对 ' + metric.code);
    assert.ok(board.trend.some(row => row.week < 0), '负相对日必须保留在趋势中');
    pass('公开八指标、部分导入和负相对日独立CSV核对', {expected, relativeDayBounds: board.relativeDayBounds});
    const firstCourse = board.courses.find(course => course.records > 0).key;
    const scoped = (await request('/api/analytics/learning/query', {...input, learningScope: {courseKeys: [firstCourse], relativeDayStart: -10, relativeDayEnd: 20}}, viewer)).data;
    const scopedExpected = independent(scoped.scope, source);
    for (const metric of scoped.metrics) assert.equal(metric.value, scopedExpected[metric.code], '课程与相对日核对 ' + metric.code);
    const zero = (await request('/api/analytics/learning/query', {...input, learningScope: {courseKeys: [firstCourse], relativeDayStart: 9999, relativeDayEnd: 10000}}, viewer)).data;
    assert.equal(zero.metrics.find(metric => metric.code === 'activity_count').value, 0); assert.equal(zero.metrics.find(metric => metric.code === 'average_score').value, null);
    const simulationBoard = (await request('/api/overview/query', {datasetId: simulation.id, scope: operationScope}, viewer)).data;
    assert.equal(simulationBoard.analysis.dataset.origin, 'simulated'); assert.equal(simulationBoard.analysis.metrics.length, 8);
    assert.ok(simulationBoard.analysis.metrics.every(metric => !metricCodes.includes(metric.code)));
    pass('范围筛选、真实零、无分数留空与模拟经营不混算');

    const knowledge = (await request('/api/knowledge/sources', {title: 'OULAD学习口径集中验收 ' + stamp, kind: 'definition', content: 'OULAD为匿名公开教育数据。课程批次由课程代码与开课批次组成，相对日是相对课程开始日，负数表示开课前。学习活动行数和点击总量分别统计，学习点击不能替代逐课签到。平均活跃天数按学员课程组合名册计算，未完成全量不能给出完整均值。免修提交从平均测评分数中排除，缺失评分单列。退出记录按相对发生日统计，最终课程结果不作为历史预测，不能推断机构续费或退款。', evidence: []}, admin, 201)).data;
    assert.equal((await request('/api/knowledge/sources/' + knowledge.id + '/approve', {expectedVersion: 1, expectedContentHash: knowledge.contentHash}, admin)).status, 'ready');
    const runInput = {...input, message: '查询当前公开学习范围，检索口径并分析学习活动、测评和退出。', requestKey: randomUUID()};
    await request('/api/agent/runs', runInput, viewer, 403); await request('/api/agent/runs', runInput, other, 404);
    const run = (await request('/api/agent/runs', runInput, admin)).data;
    assert.equal(run.status, 'completed'); assert.deepEqual(run.steps.map(step => step.tool), ['query_learning_metrics', 'search_knowledge']); assert.deepEqual(run.proposals, []);
    assert.ok(run.evidence.some(item => item.kind === 'knowledge')); assert.ok(run.evidence.some(item => item.kind === 'metric'));
    for (const fact of run.steps.flatMap(step => step.facts ?? [])) {const metric = board.metrics.find(metric => metric.label === fact.label); if (metric) assert.equal(fact.value, metric.value);}
    const repeated = (await request('/api/agent/runs', runInput, admin)).data; assert.equal(repeated.id, run.id); assert.equal(repeated.steps.length, run.steps.length);
    await request('/api/agent/runs', {...runInput, message: '改变同键问题'}, admin, 409);
    await request('/api/agent/runs', {...runInput, sessionId: run.sessionId, requestKey: randomUUID()}, admin, 400);
    await request('/api/agent/runs/' + run.id, undefined, other, 404);
    const session = (await request('/api/agent/sessions/' + run.sessionId, undefined, viewer)).data;
    assert.ok('courseKeys' in session.session.scope); assert.ok(!('startDate' in session.session.scope));
    const continued = (await request('/api/agent/runs', {sessionId: run.sessionId, message: '继续说明学习分析范围与限制。', requestKey: randomUUID()}, admin)).data;
    assert.equal(continued.status, 'completed'); assert.equal(continued.sessionId, run.sessionId);
    const denied = (await request('/api/agent/runs', {...input, message: '测试学习越权', requestKey: randomUUID()}, admin, 502)).data;
    assert.equal(denied.status, 'failed'); assert.equal(denied.errorCode, 'UNKNOWN_TOOL'); assert.deepEqual(denied.proposals, []);
    await request('/api/agent/proposals/confirm', {runId: run.id, proposalId: randomUUID(), version: 1, previewToken: randomUUID()}, admin, 403);
    pass('公开Agent只读工具、事实证据、保存/续问、机构权限、幂等和未知写工具拒绝', {runId: run.id, sessionId: run.sessionId});
    }

    browser = await chromium.launch({channel: 'msedge', headless: true});
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
    if (skipLogin) {
        const previous = JSON.parse(await readFile(qa + '/failure.json', 'utf8'));
        const verifiedLogin = previous.checks.find(check => check.name.startsWith('登录四尺寸') && check.passed);
        assert.ok(verifiedLogin, '本轮尚无登录通过记录，不能跳过'); checks.push({...verifiedLogin, reusedFromSameRound: true});
        screenshots.push(...previous.screenshots.filter(name => name.startsWith('login-')));
        await context.addInitScript(({token, user}) => {localStorage.setItem('auth_token', token); localStorage.setItem('auth_user', JSON.stringify(user)); localStorage.setItem('education-theme', 'light');}, admin);
    } else {
    const loginPage = await context.newPage(); loginPage.setDefaultTimeout(90000); loginPage.on('pageerror', error => pageErrors.push(error.message));
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [390, 844]]) {
        await loginPage.setViewportSize({width, height}); await loginPage.goto(base + '/auth/login', {waitUntil: 'networkidle'});
        await loginPage.getByRole('heading', {name: '教培运营分析辅助系统', exact: true}).waitFor();
        assert.equal(await loginPage.getByLabel('用户名', {exact: true}).getAttribute('autocomplete'), 'username');
        assert.equal(await loginPage.getByLabel('密码', {exact: true}).getAttribute('autocomplete'), 'current-password');
        await noOverflow(loginPage, '登录 ' + width); await screenshot(loginPage, 'login-' + width + 'x' + height);
    }
    await loginPage.setViewportSize({width: 1440, height: 900});
    await loginPage.getByRole('button', {name: /^登\s*录$/}).click();
    await loginPage.getByText('请输入用户名', {exact: true}).waitFor(); await loginPage.getByText('请输入密码', {exact: true}).waitFor();
    await loginPage.getByLabel('用户名', {exact: true}).fill(admin.username); await loginPage.getByLabel('密码', {exact: true}).fill('only-invalid-test-password');
    await loginPage.getByLabel('密码', {exact: true}).press('Tab');
    assert.equal(await loginPage.getByRole('button', {name: '显示密码', exact: true}).evaluate(element => element === document.activeElement), true);
    await loginPage.getByRole('button', {name: '显示密码', exact: true}).press('Space');
    assert.equal(await loginPage.getByLabel('密码', {exact: true}).getAttribute('type'), 'text');
    await loginPage.getByRole('button', {name: '隐藏密码', exact: true}).press('Enter');
    assert.equal(await loginPage.getByLabel('密码', {exact: true}).getAttribute('type'), 'password');
    let releaseLogin, loginRequests = 0;
    const loginGate = new Promise(resolve => {releaseLogin = resolve;});
    await loginPage.route('**/api/auth/login', async route => {loginRequests++; await loginGate; await route.continue();}, {times: 1});
    await loginPage.getByLabel('密码', {exact: true}).press('Enter');
    await loginPage.waitForFunction(() => document.querySelector('form[aria-busy="true"]') !== null);
    assert.equal(await loginPage.getByLabel('密码', {exact: true}).isDisabled(), true);
    assert.equal(await loginPage.locator('button[type="submit"]').getAttribute('aria-busy'), 'true');
    releaseLogin(); await loginPage.getByText('登录未成功', {exact: true}).waitFor();
    assert.equal(loginRequests, 1);
    assert.equal(await loginPage.getByLabel('用户名', {exact: true}).inputValue(), admin.username);
    await screenshot(loginPage, 'login-error-feedback');
    await loginPage.getByLabel('密码', {exact: true}).fill(password); await loginPage.getByLabel('密码', {exact: true}).press('Enter');
    await loginPage.waitForURL('**/dashboard');
    assert.equal(await loginPage.evaluate(() => !!localStorage.getItem('auth_token')), true);
    pass('登录四尺寸、表单验证、密码键盘显隐、错误反馈、回车真实登录和密码管理器');
    }

    const page = await context.newPage(); page.setDefaultTimeout(90000); page.on('pageerror', error => pageErrors.push(error.message));
    const overviewReplies = [];
    page.on('response', response => {if (response.url().endsWith('/api/overview/query') && response.request().method() === 'POST') void response.json().then(body => overviewReplies.push(body.data)).catch(() => {});});
    await page.goto(learningLink('/dashboard', publicDataset.id), {waitUntil: 'networkidle'});
    await page.getByTestId('learning-dashboard').locator('.metric-card').first().waitFor(); await page.locator('.business-chart svg').first().waitFor();
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [390, 844]]) {
        await page.setViewportSize({width, height}); await page.waitForTimeout(400); await noOverflow(page, '公开总览 ' + width);
        assert.equal(await page.getByTestId('learning-dashboard').locator('.metric-card').count(), 8);
        if (width === 1440) {
            const bounds = await page.getByTestId('learning-dashboard').locator('.metric-card').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().bottom));
            assert.ok(Math.max(...bounds) < 900, '1440×900首屏必须展示八项学习指标，当前末卡底部 ' + Math.max(...bounds));
            await screenshot(page, 'learning-firstscreen', false);
        }
        await screenshot(page, 'learning-overview-' + width + 'x' + height);
    }
    await page.setViewportSize({width: 1440, height: 900});
    await page.getByTestId('learning-dashboard').locator('.metric-card').nth(2).click(); await page.getByRole('dialog').waitFor();
    assert.ok((await page.getByRole('dialog').innerText()).includes('相对日')); await page.getByRole('dialog').locator('.ant-modal-close').click();
    await page.locator('.business-chart details > summary').first().click(); assert.equal(await page.locator('.business-chart details').first().locator('table').isVisible(), true); await page.locator('.business-chart details > summary').first().click();
    await page.getByRole('button', {name: /全屏展示/}).click(); await page.waitForFunction(() => document.querySelector('.business-shell')?.getAttribute('data-presentation') === 'true');
    assert.equal(await page.locator('.business-sidebar').isVisible(), false); await screenshot(page, 'learning-fullscreen');
    await page.getByRole('button', {name: /退出展示/}).click(); await page.waitForFunction(() => document.querySelector('.business-shell')?.getAttribute('data-presentation') === 'false');
    await page.getByRole('link', {name: /交给Agent分析/}).click(); await page.getByRole('heading', {name: /Agent学习分析助手/}).waitFor(); await page.getByLabel('Agent问题', {exact: true}).waitFor();
    assert.equal(await page.getByLabel('Agent开始日期', {exact: true}).count(), 0); assert.equal(await page.getByLabel('Agent校区', {exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: '续费跟进', exact: true}).count(), 0); assert.equal(await page.getByRole('button', {name: '运营标签工作台', exact: true}).count(), 0);
    await page.getByLabel('学习起始相对日', {exact: true}).fill('-10'); await page.getByLabel('学习结束相对日', {exact: true}).fill('20');
    await page.getByLabel('Agent问题', {exact: true}).fill('分析当前课程批次和相对日范围的学习活动，检索指标口径并说明限制。');
    const runReply = page.waitForResponse(response => response.url().endsWith('/api/agent/runs') && response.request().method() === 'POST');
    await page.getByRole('button', {name: '发送Agent问题', exact: true}).click(); const uiRun = (await (await runReply).json()).data;
    assert.equal(uiRun.status, 'completed'); assert.deepEqual(uiRun.steps.map(step => step.tool), ['query_learning_metrics', 'search_knowledge']);
    await page.getByTestId('agent-facts').waitFor(); assert.equal(await page.getByTestId('agent-proposals').count(), 0);
    const savedScope = (await request('/api/agent/sessions/' + uiRun.sessionId, undefined, admin)).data.session.scope;
    assert.equal(savedScope.relativeDayStart, -10); assert.equal(savedScope.relativeDayEnd, 20); assert.equal(await page.getByLabel('学习起始相对日', {exact: true}).isDisabled(), true);
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [390, 844]]) {
        await page.setViewportSize({width, height}); await page.waitForTimeout(300); await noOverflow(page, '学习Agent ' + width); await screenshot(page, 'learning-agent-' + width + 'x' + height);
    }
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto(learningLink('/dashboard/agent', publicDataset.id, {courseKeys: []}, {sessionId: uiRun.sessionId, runId: uiRun.id}), {waitUntil: 'networkidle'});
    await page.getByTestId('agent-facts').waitFor(); assert.equal(await page.getByLabel('学习起始相对日', {exact: true}).inputValue(), '-10');
    pass('公开总览四尺寸首屏、图表证据/数据表/全屏，页面只读Agent与保存范围恢复', {uiRunId: uiRun.id});

    await page.goto(operationLink('/dashboard', simulation.id, operationScope), {waitUntil: 'networkidle'}); await page.locator('.metric-card').first().waitFor();
    assert.equal(await page.getByTestId('learning-dashboard').count(), 0); assert.ok((await page.locator('.metric-grid').innerText()).includes('出勤率'));
    await page.getByRole('link', {name: /交给Agent分析/}).click(); await page.getByLabel('Agent开始日期', {exact: true}).waitFor();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Agent开始日期"]')?.value === '2026-08-01');
    for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [390, 844]]) {
        await page.setViewportSize({width, height}); await page.waitForTimeout(300);
        assert.equal(await page.getByLabel('Agent开始日期', {exact: true}).inputValue(), '2026-08-01'); assert.equal(await page.getByLabel('Agent结束日期', {exact: true}).inputValue(), '2026-08-31');
        const dimensions = await page.getByLabel('Agent开始日期', {exact: true}).evaluate(input => ({width: input.clientWidth, scroll: input.scrollWidth}));
        assert.ok(dimensions.width >= dimensions.scroll, '完整经营日期不可被截断 ' + width);
        await noOverflow(page, '经营Agent ' + width); await screenshot(page, 'business-agent-dates-' + width + 'x' + height);
    }
    pass('模拟经营总览与经营Agent完整日期、四尺寸不溢出');
    assert.deepEqual(pageErrors, []);
    assert.ok(overviewReplies.some(result => result?.analysisType === 'learning') && overviewReplies.some(result => result?.analysis?.dataset.origin === 'simulated'));
    const modelState = await (await fetch('http://127.0.0.1:3391/state')).json(); assert.equal(modelState.sentMemberDetails, false);
    pass('页面异常为零，模型仅收到有界聚合而无成员明细');
    await context.close();
    await writeFile(qa + '/verification.json', JSON.stringify({verifiedAt: new Date().toISOString(), base, testDatabase: 'education_cleanup_test', publicDataset: publicDataset.key, simulation: simulation.key, requests, browserOnly, skipLogin, checks, screenshots, pageErrors, fixedModelOnly: true, businessDatabaseUntouched: true}, null, 2) + '\n');
    console.log(JSON.stringify({passedGroups: checks.length, requests, screenshots: screenshots.length, artifactDirectory: qa, pageErrors}, null, 2));
} catch (failure) {
    await writeFile(qa + '/failure.json', JSON.stringify({failedAt: new Date().toISOString(), message: failure.message, checks, requests, screenshots, pageErrors}, null, 2) + '\n');
    throw failure;
} finally {if (browser) await browser.close(); await db.end();}

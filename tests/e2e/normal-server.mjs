// 正常环境最终展示：沿用本地配置与原业务库，不初始化、不生成账号或改动数据。
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {config} from 'dotenv';

const root = process.cwd();
const env = {...process.env};
config({path: [resolve(root, '.env.local'), resolve(root, '.env')], processEnv: env, quiet: true});
let database;
try { database = new URL(env.DATABASE_URL ?? ''); }
catch { throw Error('正常展示数据库连接配置无效'); }
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '15434' || database.pathname !== '/metadata_dev') {
    throw Error('正常展示仅允许本项目15434/metadata_dev数据库');
}
if (env.CLICKHOUSE_PORT !== '18123' || !['localhost', '127.0.0.1'].includes(env.CLICKHOUSE_HOST ?? '')) {
    throw Error('正常展示仅允许本项目18123 ClickHouse');
}
const mode=process.argv[2]??'production';
if(!['dev','production'].includes(mode))throw Error('模式仅允许dev/production');
const dist = process.env.NEXT_DIST_DIR ?? '.next-validation';
if(!['.next','.next-validation','.next-ux'].includes(dist))throw Error('生产构建目录无效');
const server = resolve(root, dist, 'standalone', 'server.js');
if (mode==='production'&&(!existsSync(server) || !existsSync(resolve(root, dist, 'BUILD_ID')))) throw Error('请先完成所选目录的生产构建');
delete env.APP_TEST_MODE;
const localPort=process.env.LOCAL_APP_PORT??'3000';
if(!['3000','3100'].includes(localPort))throw Error('正常展示只支持本机3000或3100端口');
Object.assign(env, {PORT: localPort, HOSTNAME: '127.0.0.1', NODE_ENV: mode==='dev'?'development':'production', NEXT_TELEMETRY_DISABLED: '1'});
if(mode==='dev')env.NEXT_DIST_DIR='.next-normal';
const child = spawn(process.execPath, mode==='dev'?['node_modules/next/dist/bin/next','dev','-H','127.0.0.1','-p',localPort]:[server], {env, stdio: 'inherit', windowsHide: true});
child.on('error', () => {console.error('正常展示启动失败'); process.exitCode = 1;});
child.on('exit', code => {process.exitCode = code ?? 1;});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));

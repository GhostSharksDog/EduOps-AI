// 显式覆盖所有服务连接；只允许专用本机测试环境，不读取环境文件。
import {spawn} from 'node:child_process';
const mode=process.argv[2]??'dev';
if(!['dev','production'].includes(mode))throw Error('仅支持dev或production');
const env={...process.env,COMPANY_REGISTRY_JSON:'',DEFAULT_COMPANY_CODE:'main',
 DATABASE_URL:'postgresql://postgres:test_password@127.0.0.1:25432/education_cleanup_test?schema=public',
 CLICKHOUSE_HOST:'127.0.0.1',CLICKHOUSE_PORT:'28123',CLICKHOUSE_USER:'default',CLICKHOUSE_PASSWORD:'test_password',CLICKHOUSE_DATABASE:'education_cleanup_test',CLICKHOUSE_CLUSTER:'',CLICKHOUSE_REPLICATED_DB:'false',
 JWT_SECRET:'phase4_test_only_secret_at_least_32_characters',JWT_EXPIRES_IN:'8h',SYSTEM_USER_ID:'6f40f555-5f1b-4d1f-807c-b209e817bfdd',REDIS_URL:'',REDIS_PASSWORD:'',REDIS_DB:'0',
 CHAT_API_BASE_URL:'http://127.0.0.1:3391/v1',CHAT_API_KEY:'fixture-only',CHAT_MODEL:'fixture-chat',
 EMBEDDING_API_BASE_URL:'http://127.0.0.1:3391/v1',EMBEDDING_API_KEY:'fixture-only',EMBEDDING_MODEL:'fixture-embedding',
 APP_TEST_MODE:'true',NEXT_TELEMETRY_DISABLED:'1',PORT:mode==='dev'?'3302':'3303',HOSTNAME:'127.0.0.1',
};
const dist=process.env.NEXT_DIST_DIR??'.next';
if(mode==='production'&&!['.next','.next-validation','.next-ux'].includes(dist))throw Error('验收构建目录仅支持项目内.next、.next-validation或.next-ux');
// Windows长时间热编译验收曾触发Turbopack内存重启，测试使用独立Webpack缓存。
if(mode==='dev')env.NEXT_DIST_DIR='.next-test-webpack';
const args=mode==='dev'?['node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p','3302']:[dist+'/standalone/server.js'];
const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill(signal);});

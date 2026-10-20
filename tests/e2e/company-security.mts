import {randomUUID} from 'node:crypto';
import {strict as assert} from 'node:assert';
import {Pool} from 'pg';
import {parse} from 'dotenv';
import * as securityModule from '../../scripts/secure-company';
const {secureRegisteredCompany,renderCompanyEnvironment}=(securityModule as unknown as {default?:typeof securityModule}).default??securityModule;

// This harness cannot use the normal project's ports, database, credentials, or environment file.
const pgAdmin=new Pool({connectionString:'postgresql://postgres:test_password@127.0.0.1:25432/postgres'}),suffix=randomUUID().replaceAll('-','').slice(0,12),database='company_security_'+suffix+'_test',code='secure_'+suffix;
const ch=async(sql:string,user='default',password='test_password')=>{const response=await fetch('http://127.0.0.1:28123',{method:'POST',headers:{'X-ClickHouse-User':user,'X-ClickHouse-Key':password},body:sql,signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Dedicated test ClickHouse failure');return response.text();};
const pgUrl='postgresql://postgres:test_password@127.0.0.1:25432/'+database;
const env:NodeJS.ProcessEnv={DATABASE_URL:pgUrl,CLICKHOUSE_HOST:'127.0.0.1',CLICKHOUSE_PORT:'28123',CLICKHOUSE_USER:'default',CLICKHOUSE_PASSWORD:'test_password',CLICKHOUSE_DATABASE:database,SYSTEM_USER_ID:'22222222-2222-4222-8222-222222222222',DEFAULT_COMPANY_CODE:code,COMPANY_REGISTRY_JSON:JSON.stringify([{code,name:'隔离测试',organizationId:'22222222-2222-4222-8222-222222222222',databaseUrlEnv:'DATABASE_URL',clickhouse:{hostEnv:'CLICKHOUSE_HOST',portEnv:'CLICKHOUSE_PORT',userEnv:'CLICKHOUSE_USER',passwordEnv:'CLICKHOUSE_PASSWORD',databaseEnv:'CLICKHOUSE_DATABASE'}}]),COMPANY_PG_ADMIN_URL:'postgresql://postgres:test_password@127.0.0.1:25432/postgres',COMPANY_CH_ADMIN_HOST:'127.0.0.1',COMPANY_CH_ADMIN_PORT:'28123',COMPANY_CH_ADMIN_USER:'default',COMPANY_CH_ADMIN_PASSWORD:'test_password'};
let runtimeRole:string|undefined,target:Pool|undefined,created=false,chCreated=false;
try{
 assert(database.endsWith('_test'));await pgAdmin.query('CREATE DATABASE "'+database+'"');created=true;target=new Pool({connectionString:pgUrl});
 await target.query('CREATE TABLE public.local_user (id integer PRIMARY KEY,name text); CREATE TABLE public.security_business (id integer PRIMARY KEY,value integer); INSERT INTO public.local_user VALUES(1,\'existing-account\'); INSERT INTO public.security_business VALUES(1,7)');
 await ch('CREATE DATABASE `'+database+'`');chCreated=true;await ch('CREATE TABLE `'+database+'`.security_business (id UInt32,value UInt32) ENGINE=Memory');await ch('INSERT INTO `'+database+'`.security_business VALUES(1,7)');
 const ownersBefore=(await target.query(`SELECT relname,pg_get_userbyid(relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY relname`)).rows;
 await assert.rejects(()=>secureRegisteredCompany(code,env,false),/管理员权限/);
 const secured=await secureRegisteredCompany(code,env,true);runtimeRole=secured.metadata.postgresRole;assert(secured.metadata.configured);assert(!secured.metadata.alreadyScoped);
 const next={...env,...secured.environmentUpdates};const registry=JSON.parse(next.COMPANY_REGISTRY_JSON!);assert.notEqual(registry[0].databaseUrlEnv,'DATABASE_URL');assert.equal(next.DATABASE_URL,env.DATABASE_URL);assert.equal(next.CLICKHOUSE_PASSWORD,env.CLICKHOUSE_PASSWORD);
 const runtime=new Pool({connectionString:next[registry[0].databaseUrlEnv]});try{assert.equal((await runtime.query('SELECT value FROM public.security_business WHERE id=1')).rows[0].value,7);assert.equal((await runtime.query('SELECT count(*) FROM public.local_user')).rows[0].count,'1');const status=(await runtime.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert(Object.values(status).every(v=>v===false));}finally{await runtime.end();}
 assert.equal((await ch('SELECT value FROM `'+database+'`.security_business',runtimeRole,next[registry[0].clickhouse.passwordEnv]!)).trim(),'7');
 assert.deepEqual((await target.query(`SELECT relname,pg_get_userbyid(relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY relname`)).rows,ownersBefore);
 assert.equal((await target.query('SELECT count(*) FROM public.security_business')).rows[0].count,'1');assert.equal((await ch('SELECT count() FROM `'+database+'`.security_business')).trim(),'1');
 const repeated=await secureRegisteredCompany(code,next,true);assert(repeated.metadata.alreadyScoped);assert.deepEqual(repeated.environmentUpdates,{});
 await assert.rejects(()=>secureRegisteredCompany(code,env,true),/已存在但未登记/);
 const original="DATABASE_URL=keep-original\r\nCLICKHOUSE_PASSWORD=keep-compose\r\nCHAT_API_KEY='fixture-model-value'\r\nEMBEDDING_MODEL=fixture-embedding\r\n";
 const written=renderCompanyEnvironment(original,secured.environmentUpdates);assert(written.includes("CHAT_API_KEY='fixture-model-value'\r\nEMBEDDING_MODEL=fixture-embedding\r\n"));assert.equal(parse(written).DATABASE_URL,'keep-original');assert.equal(parse(written).CLICKHOUSE_PASSWORD,'keep-compose');assert.equal(parse(written).CHAT_API_KEY,'fixture-model-value');assert.deepEqual(JSON.parse(parse(written).COMPANY_REGISTRY_JSON),registry);
 console.log(JSON.stringify({status:'ready',checks:8,company:code,postgresDatabase:database,clickhouseDatabase:database,originalRowsAndOwners:'unchanged',idempotent:'verified',credentialsPrinted:false,normalDatabaseTouched:false,localEnvironmentTouched:false}));
}catch(error){console.error('Company security dedicated-test verification failed',error instanceof Error&&error.name==='SecurityFailure'?error.message:(error as {code?:string})?.code??'ASSERTION_OR_RUNTIME_ERROR');process.exitCode=1;}finally{
 if(target){if(runtimeRole)await target.query('DROP OWNED BY "'+runtimeRole+'"').catch(()=>{});await target.end();}
 if(runtimeRole){await ch('DROP USER IF EXISTS `'+runtimeRole+'`').catch(()=>{});await pgAdmin.query('DROP ROLE IF EXISTS "'+runtimeRole+'"').catch(()=>{});}
 if(chCreated)await ch('DROP DATABASE `'+database+'`').catch(()=>{});if(created)await pgAdmin.query('DROP DATABASE "'+database+'"').catch(()=>{});await pgAdmin.end();
}

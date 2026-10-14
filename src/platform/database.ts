import 'server-only';
import {Pool,type PoolClient,type QueryResultRow} from 'pg';

export type DbClient=Pick<PoolClient,'query'>;
const state=globalThis as typeof globalThis & {educationDatabasePool?:Pool};
function pool():Pool{
 if(state.educationDatabasePool)return state.educationDatabasePool;
 const created=new Pool({connectionString:process.env.DATABASE_URL??'postgresql://postgres:local_dev_password@localhost:15434/metadata_dev',max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
 // 断开的空闲连接由pg移除；不让Docker重启触发无人处理的error事件或泄露连接内容。
 created.on('error',()=>{console.warn('数据库空闲连接已断开，后续请求将重新连接。');});
 return state.educationDatabasePool=created;
}
// 延迟建立连接，CLI可先加载环境配置，开发热更新复用连接池。
export const db=new Proxy({} as Pool,{get(_target,key){if(key==='end')return async()=>{const current=state.educationDatabasePool;delete state.educationDatabasePool;if(current)await current.end();};const value=Reflect.get(pool(),key);return typeof value==='function'?value.bind(pool()):value;}});
export async function queryRows<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[],client:DbClient=db):Promise<T[]>{return (await client.query<T>(text,params)).rows;}
export async function queryOne<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[],client:DbClient=db):Promise<T|null>{return (await queryRows<T>(text,params,client))[0]??null;}
export async function execute(text:string,params:unknown[]=[],client:DbClient=db):Promise<number>{return (await client.query(text,params)).rowCount??0;}
export async function transaction<T>(work:(client:DbClient)=>Promise<T>,options:{timeoutMs?:number}={}):Promise<T>{
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  await client.query("SELECT set_config('statement_timeout',$1,true)",[String(options.timeoutMs??30000)]);
  const result=await work(client);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}
}
export function mapRow<T>(row:Record<string,unknown>,overrides:Record<string,string>={}):T{
 return Object.fromEntries(Object.entries(row).map(([key,value])=>[overrides[key]??key.replace(/_([a-z])/g,(_match,letter:string)=>letter.toUpperCase()),value])) as T;
}

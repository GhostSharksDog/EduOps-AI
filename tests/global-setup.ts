export default async function globalSetup(){
 const database=process.env.DATABASE_URL,base=process.env.TEST_SERVER_URL;
 if(!database||!new URL(database).pathname.endsWith('_test'))throw new Error('必须配置专用 *_test 数据库');
 if(!base)throw new Error('必须显式配置 TEST_SERVER_URL 并先启动隔离的测试应用');
 const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('测试应用健康检查失败');
 const health=await response.json();
 if(health.testMode!==true)throw new Error('指定应用不是隔离的测试服务');
}

import 'server-only';
export const config={
 database:{url:process.env.DATABASE_URL??'postgresql://postgres:local_dev_password@localhost:15434/metadata_dev'},
 clickhouse:{host:process.env.CLICKHOUSE_HOST??'localhost',port:Number(process.env.CLICKHOUSE_PORT??8123),user:process.env.CLICKHOUSE_USER??'default',password:process.env.CLICKHOUSE_PASSWORD??'',database:process.env.CLICKHOUSE_DATABASE??'default',cluster:process.env.CLICKHOUSE_CLUSTER??'',replicatedDb:process.env.CLICKHOUSE_REPLICATED_DB==='true'},
 system:{userId:process.env.SYSTEM_USER_ID??'6f40f555-5f1b-4d1f-807c-b209e817bfdd'},
 jwt:{secret:process.env.JWT_SECRET??'',expiry:process.env.JWT_EXPIRES_IN??'8h'},
 auth:{tokenKey:'auth_token',userKey:'auth_user'},
 redis:{url:process.env.REDIS_URL??'redis://localhost:6379',password:process.env.REDIS_PASSWORD||undefined,db:Number(process.env.REDIS_DB??0),enabled:!!process.env.REDIS_URL},
};

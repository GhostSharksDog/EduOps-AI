import 'server-only';
import {getCompanyContext} from '../company/context';
import {getDefaultCompany,companyClickHouse,companyPostgresUrl} from '../company/registry';
export const config={
 database:{get url(){const context=getCompanyContext();if(!context)throw new Error('缺少已验证公司上下文');return companyPostgresUrl(context.company);}},
 get clickhouse(){const context=getCompanyContext();if(!context)throw new Error('缺少已验证公司上下文');return companyClickHouse(context.company);},
 system:{get userId(){return (getCompanyContext()?.company??getDefaultCompany()).organizationId;}},
 jwt:{secret:process.env.JWT_SECRET??'',expiry:process.env.JWT_EXPIRES_IN??'8h'},
 auth:{tokenKey:'auth_token',userKey:'auth_user'},
 redis:{url:process.env.REDIS_URL??'redis://localhost:6379',password:process.env.REDIS_PASSWORD||undefined,db:Number(process.env.REDIS_DB??0),enabled:!!process.env.REDIS_URL},
};

import {beforeEach,afterEach,vi} from 'vitest';
import {configureTestCompanyContext,clearTestCompanyContext} from '@/platform/company/context';
/** 纯单元夹具显式登记身份；数据库与网络仍由回归入口禁止。 */
export function useCompanyUnitFixture(organizationId='a0000000-0000-4000-8000-000000000003'){
 beforeEach(()=>{vi.stubEnv('COMPANY_REGISTRY_JSON','');vi.stubEnv('DEFAULT_COMPANY_CODE','main');vi.stubEnv('SYSTEM_USER_ID',organizationId);vi.stubEnv('DATABASE_URL','postgresql://fixture:fixture@127.0.0.1:25432/regression_test');vi.stubEnv('CLICKHOUSE_HOST','127.0.0.1');vi.stubEnv('CLICKHOUSE_PORT','28123');vi.stubEnv('CLICKHOUSE_DATABASE','regression_test');configureTestCompanyContext('main');});
 afterEach(()=>{clearTestCompanyContext();vi.unstubAllEnvs();});
 return organizationId;
}

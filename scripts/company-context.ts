import {config as loadEnv} from 'dotenv';
import {runWithCompany} from '../src/platform/company/context';
import {getDefaultCompany,getCompany} from '../src/platform/company/registry';

// CLI 只选择已登记的公司，不接受命令行连接串，避免误用其他公司或真实库。
export function runCompanyCommand<T>(work:()=>Promise<T>):Promise<T>{
 loadEnv({path:'.env.local',quiet:true});loadEnv({quiet:true});
 const args=process.argv.slice(2),index=args.indexOf('--company');
 if(index>=0&&(!args[index+1]||args[index+1].startsWith('--')))return Promise.reject(new Error('--company 缺少公司代码'));
 const selected=index>=0?getCompany(args[index+1]):getDefaultCompany();
 return runWithCompany(selected.code,work);
}

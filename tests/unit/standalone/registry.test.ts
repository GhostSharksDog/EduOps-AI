import {describe,it,expect} from 'vitest';
import {ToolRegistry} from '@/modules/agent/services/registry';
import {CapabilityUnavailableError} from '@/shared/contracts/unavailable';
const scope={startDate:'2027-01-01',endDate:'2027-01-07',campusIds:[],courseIds:[],channelIds:[],organizationId:'test-org',authorizedCampusIds:[]};
describe('受控工具注册',()=>{
 it('未实现工具不会生成虚假的成功结果',async()=>{const registry=new ToolRegistry();registry.register({name:'preview',description:'预览',mode:'read',status:'not_implemented'});await expect(registry.execute('preview',{},scope)).rejects.toBeInstanceOf(CapabilityUnavailableError);});
 it('拒绝重复工具名并显式传递服务端范围',async()=>{const registry=new ToolRegistry();registry.register({name:'query',description:'查询',mode:'read',status:'ready'},async(_,authorized)=>({status:'ready',message:authorized.organizationId,data:authorized.authorizedCampusIds}));expect(()=>registry.register({name:'query',description:'重复',mode:'read',status:'ready'})).toThrow();expect((await registry.execute('query',{},scope)).message).toBe('test-org');});
});

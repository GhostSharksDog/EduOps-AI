import {describe,it,expect} from 'vitest';
import {ToolRegistry} from '@/modules/agent/services/registry';
import {CapabilityUnavailableError} from '@/shared/contracts/unavailable';
const scope={startDate:'2027-01-01',endDate:'2027-01-07',campusIds:[],courseIds:[],channelIds:[],organizationId:'test-org',authorizedCampusIds:[]};
const context={actor:{userId:'fixture-user',organizationId:scope.organizationId,role:'viewer'},runId:'fixture-run',toolCallId:'fixture-tool',datasetId:'fixture-dataset',signal:new AbortController().signal};
describe('受控工具注册',()=>{
 it('未实现工具不会生成虚假的成功结果',async()=>{const registry=new ToolRegistry();registry.register({name:'preview',description:'预览',mode:'read',status:'not_implemented'});await expect(registry.execute('preview',{},scope)).rejects.toBeInstanceOf(CapabilityUnavailableError);});
 it('拒绝重复工具名并显式传递服务端范围',async()=>{const registry=new ToolRegistry();registry.register({name:'query',description:'查询',mode:'read',status:'ready'},async(_,authorized)=>({status:'ready',message:authorized.organizationId,data:authorized.authorizedCampusIds}));expect(()=>registry.register({name:'query',description:'重复',mode:'read',status:'ready'})).toThrow();await expect(registry.execute('query',{},scope)).rejects.toMatchObject({code:'INVALID_CONTEXT'});expect((await registry.execute('query',{},scope,context)).message).toBe('test-org');});
});

import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const mocks=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),query:vi.fn()}));
vi.mock('@/modules/identity/server',()=>({withCompanyRoute:(handler:unknown)=>handler,authMiddleware:mocks.auth,getCurrentUser:mocks.user}));
vi.mock('@/modules/overview/server',()=>({queryWorkbench:mocks.query}));
import {GET} from '@/app/api/workbench/route';
describe('工作台只读接口身份与参数',()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue(undefined);mocks.user.mockReturnValue({id:'verified-user',ownedBy:'verified-company',role:'viewer'});mocks.query.mockResolvedValue({counts:{all:0},todos:{items:[]}});});
 it('从服务端身份传入公司与账号，并禁用响应缓存',async()=>{
  const response=await GET(new NextRequest('http://local/api/workbench?type=task&page=2'));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.query).toHaveBeenCalledWith({type:'task',page:2},{organizationId:'verified-company',userId:'verified-user',role:'viewer'});
 });
 it('未认证不执行摘要读取',async()=>{mocks.auth.mockResolvedValue(NextResponse.json({error:'未登录'},{status:401}));const response=await GET(new NextRequest('http://local/api/workbench'));expect(response.status).toBe(401);expect(mocks.query).not.toHaveBeenCalled();});
 it.each(['userId=another','organizationId=another','companyCode=another','page=0','page=1&page=2','type=all&type=task','scope=%7B%7D'])('拒绝伪造身份、重复或无效查询：%s',async query=>{const response=await GET(new NextRequest('http://local/api/workbench?'+query));expect(response.status).toBe(400);expect(mocks.query).not.toHaveBeenCalled();});
});

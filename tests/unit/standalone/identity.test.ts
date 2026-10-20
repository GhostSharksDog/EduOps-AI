import {describe,it,expect,vi} from 'vitest';
import {hashPassword,verifyPassword} from '@/modules/identity/domain/password';
import {canAccess} from '@/modules/identity/contracts/local';
describe('独立账号与权限',()=>{
 it('密码采用随机盐，正确密码可验证而错误密码不能验证',async()=>{const a=await hashPassword('graduation-example-2027'),b=await hashPassword('graduation-example-2027');expect(a).not.toBe(b);expect(a).not.toContain('graduation-example');expect(await verifyPassword('graduation-example-2027',a)).toBe(true);expect(await verifyPassword('wrong',a)).toBe(false);});
 it('拒绝弱密码和损坏的密码摘要',async()=>{await expect(hashPassword('short')).rejects.toThrow();expect(await verifyPassword('x','broken')).toBe(false);});
 it('只读用户能查询Agent但不能创建标签或确认业务计划',()=>{expect(canAccess('viewer','GET','/api/tags')).toBe(true);expect(canAccess('viewer','POST','/api/tags')).toBe(false);expect(canAccess('viewer','POST','/api/agent/runs')).toBe(true);expect(canAccess('viewer','POST','/api/agent/actions/confirm')).toBe(false);});
 it('只读学习查询只开放明确路径，不能因此访问任意写入接口',()=>{expect(canAccess('viewer','POST','/api/analytics/learning/query')).toBe(true);expect(canAccess('viewer','POST','/api/analytics/finance/query')).toBe(true);expect(canAccess('viewer','POST','/api/analytics/finance/import')).toBe(false);expect(canAccess('viewer','POST','/api/analytics/learning/query/confirm')).toBe(false);expect(canAccess('viewer','POST','/api/analytics/learning/import')).toBe(false);});
 it('运营人员能管理业务但不能管理系统和账号',()=>{expect(canAccess('operator','POST','/api/tags')).toBe(true);expect(canAccess('operator','GET','/api/settings')).toBe(false);expect(canAccess('operator','POST','/api/auth/users')).toBe(false);expect(canAccess('admin','POST','/api/settings')).toBe(true);expect(canAccess('unknown','GET','/api/tags')).toBe(false);});
});

vi.mock('@/platform/config/index',()=>({config:{jwt:{secret:'unit-test-secret-at-least-32-characters',expiry:'1h'}}}));
import {createLocalJWT,verifyJWT,extractUserFromJWT} from '@/modules/identity/services/jwt-utils';
describe('本地账号 JWT',()=>{
 const user={id:'11111111-1111-4111-8111-111111111111',username:'operator',realName:'运营测试',email:'',role:'operator',ownedBy:'22222222-2222-4222-8222-222222222222',companyCode:'example'};
 it('真实签名可验证并返回机构及角色，仅签发必要身份字段',async()=>{
  const token=await createLocalJWT({...user,unexpected:'do-not-copy'} as typeof user);
  const payload=await verifyJWT(token);expect(payload).toMatchObject(user);expect(payload).not.toHaveProperty('unexpected');expect(payload.exp).toBeGreaterThan(payload.iat as number);expect(await extractUserFromJWT(token)).toEqual(user);
 });
 it('修改载荷后不能通过签名验证',async()=>{
  const token=await createLocalJWT(user),parts=token.split('.');parts[1]=Buffer.from(JSON.stringify({...user,role:'admin'})).toString('base64url');
  await expect(verifyJWT(parts.join('.'))).rejects.toThrow('Token 无效或已过期');
 });
});

import {describe,it,expect,vi,beforeEach} from 'vitest';
import {getCurrentTenantId,getTenantFilter,isTenantIsolationEnabled,createTenantFilter,applyTenantFilterToWhere,verifyOwnership} from '@/platform/get-current-tenant';
const state=vi.hoisted(()=>({enabled:true}));
vi.mock('@/platform/company/context',()=>({requireCompanyContext:()=>{if(!state.enabled)throw Error('缺少已验证公司上下文');return {company:{organizationId:'verified-company'}};}}));
describe('公司身份只能来自已验证上下文',()=>{
 beforeEach(()=>{state.enabled=true;});
 it('忽略任意公司请求头，缺少请求头也使用已验证公司',()=>{for(const value of ['spoofed-company','','verified-company'])expect(getCurrentTenantId(new Request('http://localhost',{headers:{'x-tenant-id':value}}))).toBe('verified-company');expect(getCurrentTenantId(new Request('http://localhost'))).toBe('verified-company');});
 it('无公司上下文不回退为系统身份',()=>{state.enabled=false;expect(()=>getCurrentTenantId(new Request('http://localhost'))).toThrow('上下文');expect(()=>createTenantFilter()).toThrow('上下文');expect(()=>applyTenantFilterToWhere({name:'test'})).toThrow('上下文');});
 it('未传过滤选项仍明确过滤当前公司，跨公司参数拒绝',()=>{expect(createTenantFilter()).toEqual({tenantId:'verified-company'});expect(createTenantFilter('verified-company')).toEqual({tenantId:'verified-company'});expect(()=>createTenantFilter('foreign-company')).toThrow('不一致');});
 it('过滤保留已有业务条件，不添加跨公司系统记录',()=>{const where={name:'test',AND:[{deletedAt:null}]};expect(applyTenantFilterToWhere(where)).toEqual({...where,ownedBy:'verified-company'});expect(applyTenantFilterToWhere(where,{})).toEqual({...where,ownedBy:'verified-company'});expect(applyTenantFilterToWhere(where,{tenantId:'verified-company'})).toEqual({...where,ownedBy:'verified-company'});});
 it('隔离与所有权校验始终启用',()=>{const request=new Request('http://localhost');expect(getTenantFilter(request)).toEqual({ownedBy:'verified-company'});expect(isTenantIsolationEnabled(request)).toBe(true);expect(verifyOwnership('verified-company')).toBe(true);expect(verifyOwnership('system-user-id')).toBe(false);state.enabled=false;expect(()=>isTenantIsolationEnabled(request)).toThrow('上下文');});
});

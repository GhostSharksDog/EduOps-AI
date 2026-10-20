import {describe,it,expect,vi,beforeEach} from 'vitest';
import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
const companyId=useCompanyUnitFixture();
const database=vi.hoisted(()=>({queryOne:vi.fn(),queryRows:vi.fn(),execute:vi.fn(),transaction:vi.fn()}));
vi.mock('@/platform/database',()=>database);
beforeEach(()=>{vi.clearAllMocks();database.queryOne.mockResolvedValue(null);database.queryRows.mockResolvedValue([]);database.execute.mockResolvedValue(0);database.transaction.mockImplementation(async(work:(client:unknown)=>Promise<unknown>)=>work({query:vi.fn()}));});
import {DatabaseMaterializedViewConfigRepository} from '@/modules/tag/repositories/DatabaseMaterializedViewConfigRepository';
const config={id:'config',tagId:'tag',versionId:'version',mvName:'view',mvResultTable:'result',refreshInterval:'1h',ownedBy:companyId,stepOrder:2,isCascade:true,createTime:new Date()};
describe('物化视图配置',()=>{
 it('同标签的级联步骤返回明确顺序和机构',async()=>{
  database.queryRows.mockResolvedValue([{...config,updateTime:null}]);
  expect(await new DatabaseMaterializedViewConfigRepository().findByTagIdAndVersionId('tag','version',{tenantId:companyId})).toEqual([{...config,updateTime:undefined}]);
  const [sql,params]=database.queryRows.mock.calls[0];expect(sql).toContain('delete_time IS NULL');expect(sql).toContain('ORDER BY step_order ASC');expect(params.slice(0,3)).toEqual(['tag','version',companyId]);
 });
 it('更新无权访问或已删除的配置必须失败',async()=>{
  await expect(new DatabaseMaterializedViewConfigRepository().update(config,{tenantId:'other'})).rejects.toThrow();
  const [sql,params]=database.queryOne.mock.calls[0];expect(sql).toContain('delete_time IS NULL');expect(sql).toContain('owned_by=');expect(params).toContain('other');
 });
 it('批量删除也保留机构范围，单项不存在时拒绝操作',async()=>{
  const repository=new DatabaseMaterializedViewConfigRepository();await repository.deleteByTagId('tag',{tenantId:companyId});
  expect(database.execute.mock.calls[0][0]).toContain('delete_time=NOW()');expect(database.execute.mock.calls[0][1].slice(0,2)).toEqual(['tag',companyId]);
  await expect(repository.delete('missing',{tenantId:companyId})).rejects.toThrow();
 });
});

import {describe,it,expect,vi,beforeEach} from 'vitest';
const database=vi.hoisted(()=>({queryOne:vi.fn(),queryRows:vi.fn(),execute:vi.fn(),transaction:vi.fn()}));
vi.mock('@/platform/database',()=>database);
beforeEach(()=>{vi.clearAllMocks();database.queryOne.mockResolvedValue(null);database.queryRows.mockResolvedValue([]);database.execute.mockResolvedValue(0);database.transaction.mockImplementation(async(work:(client:unknown)=>Promise<unknown>)=>work({query:vi.fn()}));});
import {DatabaseTagRepository} from '@/modules/tag/repositories/DatabaseTagRepository';
describe('标签软删除查询',()=>{
 it('标签、分类和版本均排除软删除记录，机构不由模型或浏览器覆盖',async()=>{
  const repository=new DatabaseTagRepository();expect(await repository.findById('tag',{tenantId:'org'})).toBeNull();expect(await repository.findCategoryById('category',{tenantId:'org'})).toBeNull();expect(await repository.findVersionById('version')).toBeNull();
  for(const [sql]of database.queryOne.mock.calls)expect(sql).toContain('is_deleted=FALSE');expect(database.queryOne.mock.calls[0][1]).toContain('org');expect(database.queryOne.mock.calls[1][1]).toContain('org');
 });
});

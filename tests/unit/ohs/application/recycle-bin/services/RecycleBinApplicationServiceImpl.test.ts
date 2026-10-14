import {describe,it,expect,vi,beforeEach} from 'vitest';
const database=vi.hoisted(()=>({queryOne:vi.fn(),queryRows:vi.fn(),execute:vi.fn(),transaction:vi.fn()}));
vi.mock('@/platform/database',()=>database);
beforeEach(()=>{vi.clearAllMocks();database.queryOne.mockResolvedValue(null);database.queryRows.mockResolvedValue([]);database.execute.mockResolvedValue(0);database.transaction.mockImplementation(async(work:(client:unknown)=>Promise<unknown>)=>work({query:vi.fn()}));});
vi.mock('@/modules/tag/server',()=>({getClickHouseClient:vi.fn()}));
import {RecycleBinApplicationServiceImpl} from '@/modules/system/services/recycle-bin/RecycleBinApplicationServiceImpl';
import {RecycleBinItemType} from '@/shared/enums/index';
describe('回收站边界和级联',()=>{
 it('无效日期在读取数据库前被拒绝',async()=>{
  await expect(new RecycleBinApplicationServiceImpl().listRecycleBinItems({page:1,pageSize:10,deletedFrom:'invalid-date'})).rejects.toThrow();expect(database.queryRows).not.toHaveBeenCalled();
 });
 it('无所属权限不能永久删除，亦不会修改关联对象',async()=>{
  database.queryOne.mockResolvedValue({id:'model',owned_by:'other'});
  await expect(new RecycleBinApplicationServiceImpl().permanentlyDeleteRecycleBinItem({id:'model',type:RecycleBinItemType.DATA_MODEL,tenantFilter:{tenantId:'org'}})).rejects.toMatchObject({statusCode:404});expect(database.execute).not.toHaveBeenCalled();
 });
 it('删除数据模型前删除其字段，操作处于同一事务',async()=>{
  database.queryOne.mockResolvedValue({id:'model',owned_by:'org'});
  expect(await new RecycleBinApplicationServiceImpl().permanentlyDeleteRecycleBinItem({id:'model',type:RecycleBinItemType.DATA_MODEL,tenantFilter:{tenantId:'org'}})).toEqual({success:true});
  expect(database.execute.mock.calls[0][0]).toContain('DELETE FROM model_column');expect(database.execute.mock.calls[1][0]).toContain('DELETE FROM public.data_model');expect(database.execute.mock.calls[0][2]).toBe(database.execute.mock.calls[1][2]);
 });
 it('批量恢复去重，同一标签不会重复恢复，标签恢复为停用状态',async()=>{
  database.queryOne.mockResolvedValue({id:'tag',owned_by:'org'});const item={id:'tag',type:RecycleBinItemType.TAG};
  expect(await new RecycleBinApplicationServiceImpl().batchRestoreRecycleBinItems({ids:[item,item],restoredBy:'user',tenantFilter:{tenantId:'org'}})).toEqual({success:true,restoredCount:1});expect(database.execute).toHaveBeenCalledTimes(1);expect(database.execute.mock.calls[0][0]).toContain("status='INACTIVE'");
 });
});

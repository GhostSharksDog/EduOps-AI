import {describe,it,expect,vi,beforeEach} from 'vitest';
const database=vi.hoisted(()=>({queryOne:vi.fn(),queryRows:vi.fn(),execute:vi.fn(),transaction:vi.fn()}));
vi.mock('@/platform/database',()=>database);
beforeEach(()=>{vi.clearAllMocks();database.queryOne.mockResolvedValue(null);database.queryRows.mockResolvedValue([]);database.execute.mockResolvedValue(0);database.transaction.mockImplementation(async(work:(client:unknown)=>Promise<unknown>)=>work({query:vi.fn()}));});
import {BitmapTableRepositoryImpl} from '@/modules/tag/repositories/BitmapTableRepositoryImpl';
const bitmap={id:'bitmap',entityType:'student',entityTypeId:'type',ownedBy:'org',sequence:1,totalBits:4,usedBits:[0],status:'ACTIVE',createTime:new Date(),updateTime:null,deleteTime:null,isDeleted:false};
describe('位图位分配和释放',()=>{
 it('已有位图按首个空闲位分配，保留其他已用位',async()=>{
  database.queryOne.mockResolvedValueOnce(bitmap).mockResolvedValueOnce({...bitmap,usedBits:[0,1]});
  const result=await new BitmapTableRepositoryImpl().allocateBitAtomically('type','student','org');
  expect(result).toMatchObject({bitPosition:1,isNewTable:false,bitmapTableData:{usedBits:[0,1]}});
  expect(database.execute.mock.calls[0][0]).toContain('pg_advisory_xact_lock');expect(database.queryOne.mock.calls[0][0]).toContain('FOR UPDATE');
 });
 it('位越界在修改前被拒绝',async()=>{
  database.queryOne.mockResolvedValue(bitmap);
  await expect(new BitmapTableRepositoryImpl().assignBitAt('bitmap',4)).rejects.toThrow('位索引超出范围');expect(database.queryOne).toHaveBeenCalledTimes(1);
 });
 it('已有分配不能重复覆盖，错误传播到事务边界',async()=>{
  database.queryOne.mockResolvedValueOnce(bitmap).mockResolvedValueOnce(null);
  await expect(new BitmapTableRepositoryImpl().assignBitAt('bitmap',0)).rejects.toThrow('该位已分配');
  expect(database.queryOne.mock.calls[1][0]).toContain('NOT(used_bits @>');
 });
 it('释放后保留其他位，已释放的位返回空结果',async()=>{
  const repository=new BitmapTableRepositoryImpl();database.queryOne.mockResolvedValueOnce({...bitmap,usedBits:[0]});
  expect((await repository.releaseBitAt('bitmap',1))?.usedBits).toEqual([0]);
  database.queryOne.mockResolvedValueOnce(null);expect(await repository.releaseBitAt('bitmap',1)).toBeNull();
  expect(database.queryOne.mock.calls[0][1]).toEqual(['bitmap',1,'[1]']);
 });
});

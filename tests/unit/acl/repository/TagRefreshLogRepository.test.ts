import {describe,it,expect,vi,beforeEach} from 'vitest';
const database=vi.hoisted(()=>({queryOne:vi.fn(),queryRows:vi.fn(),execute:vi.fn(),transaction:vi.fn()}));
vi.mock('@/platform/database',()=>database);
beforeEach(()=>{vi.clearAllMocks();database.queryOne.mockResolvedValue(null);database.queryRows.mockResolvedValue([]);database.execute.mockResolvedValue(0);database.transaction.mockImplementation(async(work:(client:unknown)=>Promise<unknown>)=>work({query:vi.fn()}));});
import {TagRefreshLogRepositoryImpl} from '@/modules/tag/repositories/TagRefreshLogRepositoryImpl';
describe('标签刷新日志',()=>{
 it('返回日志的机构和时间，缺失错误内容保持可区分',async()=>{
  const now=new Date();database.queryRows.mockResolvedValue([{id:'log',tag_id:'tag',mv_name:'view',owned_by:'org',error_message:null,occurred_at:now,is_resolved:false,create_time:now}]);
  expect(await new TagRefreshLogRepositoryImpl().findByTagId('tag',20)).toEqual([{id:'log',tagId:'tag',mvName:'view',ownedBy:'org',errorMessage:undefined,occurredAt:now,isResolved:false,createTime:now}]);
  expect(database.queryRows.mock.calls[0][1]).toEqual(['tag',20]);
 });
 it('未解决错误可检测，并返回实际批量解决数量',async()=>{
  database.queryOne.mockResolvedValue({id:'log'});database.execute.mockResolvedValue(3);const repository=new TagRefreshLogRepositoryImpl();
  expect(await repository.hasUnresolvedError('tag','view')).toBe(true);expect(await repository.markResolvedByTagAndMv('tag','view')).toBe(3);
  expect(database.execute.mock.calls[0][0]).toContain('is_resolved=FALSE');expect(database.execute.mock.calls[0][1]).toEqual(['tag','view']);
 });
 it('清理只针对早于截止时间的记录，返回实际清理数量',async()=>{
  database.execute.mockResolvedValue(2);const before=new Date();before.setDate(before.getDate()-30);
  expect(await new TagRefreshLogRepositoryImpl().deleteOlderThan(30)).toBe(2);
  const [sql,params]=database.execute.mock.calls[0];expect(sql).toContain('occurred_at<$1');expect(params[0].getTime()).toBeGreaterThanOrEqual(before.getTime());
 });
});
